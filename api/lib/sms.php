<?php
/**
 * sms.ir verify-send client.
 *
 * POST https://api.sms.ir/v1/send/verify
 *   header  x-api-key: <key>
 *   body    {"mobile":"9146306050","templateId":123,"parameters":[{"name":"CODE","value":"12345"}]}
 *   ok      {"status":1,"message":"موفق","data":{"messageId":...,"cost":...}}
 *
 * The key only ever exists here, server side. It is read from a config file
 * above the web root and is never returned to a caller or written to a log.
 */
declare(strict_types=1);

const CC_SMS_ENDPOINT = 'https://api.sms.ir/v1/send/verify';

/**
 * @return array{ok:bool, error?:string, detail?:string}
 */
function cc_sms_send_code(string $phone, string $code): array
{
    $cfg = cc_config()['sms'] ?? [];

    // Dry run: prove the whole flow without spending credit. The code goes to a
    // file outside the web root, never into the HTTP response.
    if (!empty($cfg['dry_run'])) {
        cc_log(sprintf('DRY RUN — code for 0%s is %s', $phone, $code));
        return ['ok' => true, 'dry_run' => true];
    }

    $key = (string) ($cfg['api_key'] ?? '');
    $templateId = (int) ($cfg['template_id'] ?? 0);
    $paramName = (string) ($cfg['param_name'] ?? 'CODE');

    if ($key === '' || str_starts_with($key, 'PUT-') || $templateId <= 0) {
        cc_log('sms not configured: api_key or template_id missing');
        return ['ok' => false, 'error' => 'sms_not_configured'];
    }

    $payload = json_encode([
        'mobile'     => $phone,
        'templateId' => $templateId,
        'parameters' => [
            ['name' => $paramName, 'value' => $code],
        ],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init(CC_SMS_ENDPOINT);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Accept: application/json',
            'x-api-key: ' . $key,
        ],
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        cc_log('sms transport error: ' . $curlErr);
        return ['ok' => false, 'error' => 'sms_unreachable', 'detail' => $curlErr];
    }

    $res = json_decode((string) $raw, true);
    $status = is_array($res) ? (int) ($res['status'] ?? 0) : 0;

    // sms.ir signals success with status === 1.
    if ($status === 1) {
        return ['ok' => true];
    }

    // Log enough to debug, never the key and never the code.
    cc_log(sprintf(
        'sms send failed: http=%d status=%d message=%s',
        $httpCode,
        $status,
        is_array($res) ? (string) ($res['message'] ?? '') : substr((string) $raw, 0, 200)
    ));
    return [
        'ok'     => false,
        'error'  => 'sms_rejected',
        'detail' => is_array($res) ? (string) ($res['message'] ?? '') : '',
    ];
}
