<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
define('FALBEY_FORMS_TEST_MODE', true);
require __DIR__ . '/../public/form-handler.php';

$count = 0;
$calls = [];
$baseServer = [
    'REQUEST_METHOD' => 'POST',
    'CONTENT_TYPE' => 'application/x-www-form-urlencoded;charset=UTF-8',
    'CONTENT_LENGTH' => '140',
    'HTTP_ORIGIN' => 'https://falbeybooks.com',
    'HTTP_HOST' => 'falbeybooks.com',
    'REMOTE_ADDR' => '192.0.2.7',
    'HTTP_SEC_FETCH_SITE' => 'same-origin',
];
$basePost = ['form-name' => 'contact', 'name' => 'Test Reader', 'email' => 'reader@example.com', 'message' => "Test line one.\nTest line two.", 'bot-field' => ''];
$accept = static function ($to, $subject, $body, $headers) use (&$calls): bool {
    $calls[] = compact('to', 'subject', 'body', 'headers');
    return true;
};
$reject = static function (): bool { return false; };
$throw = static function (): bool { throw new RuntimeException('Simulated mail failure'); };

function check(bool $condition, string $description): void
{
    global $count;
    if (!$condition) {
        fwrite(STDERR, 'FAIL: ' . $description . "\n");
        exit(1);
    }
    $count++;
}
function expect(array $server, array $post, string $transport, callable $send, int $status, string $code): array
{
    $result = falbey_handle($server, $post, $transport, $send);
    check($result['status'] === $status && $result['body']['code'] === $code, $status . ' / ' . $code);
    check($result['body']['ok'] === ($status >= 200 && $status < 300), 'ok matches status');
    return $result;
}

$result = expect($baseServer, $basePost, 'mail', $accept, 200, 'message_accepted');
check(strpos($result['body']['message'], 'accepted for delivery') !== false, 'No inbox receipt promised');
check(count($calls) === 1 && $calls[0]['to'] === 'wayne@falbeygroup.com', 'Fixed recipient');
check($calls[0]['headers']['From'] === 'Falbey Books <noreply@falbeybooks.com>', 'Fixed sender');
check($calls[0]['headers']['Reply-To'] === 'reader@example.com', 'Validated reply address');
check(strpos($calls[0]['body'], "Test line one.\nTest line two.") !== false, 'Message newlines preserved');

$newsletter = array_replace($basePost, ['form-name' => 'newsletter', 'name' => '', 'message' => '']);
$result = expect($baseServer, $newsletter, 'mail', $accept, 200, 'request_received');
check(strpos($result['body']['message'], 'not yet enrolled') !== false, 'Newsletter request not enrollment');
check(strpos($calls[1]['body'], 'has not enrolled') !== false, 'Author receives manual request explanation');

$callCount = count($calls);
expect($baseServer, $basePost, 'disabled', $accept, 503, 'delivery_unavailable');
expect($baseServer, $basePost, 'test', $accept, 503, 'delivery_unavailable');
check(count($calls) === $callCount, 'Disabled transport never sends');
expect($baseServer, $basePost, 'mail', $reject, 503, 'delivery_unavailable');
expect($baseServer, $basePost, 'mail', $throw, 503, 'delivery_unavailable');
expect($baseServer, array_replace($basePost, ['bot-field' => 'bot']), 'mail', $accept, 200, 'request_received');
check(count($calls) === $callCount, 'Honeypot never sends');

expect(array_replace($baseServer, ['REQUEST_METHOD' => 'GET']), $basePost, 'mail', $accept, 405, 'method_not_allowed');
expect(array_replace($baseServer, ['CONTENT_LENGTH' => 32768]), $basePost, 'disabled', $accept, 503, 'delivery_unavailable');
expect(array_replace($baseServer, ['CONTENT_LENGTH' => 32769]), $basePost, 'mail', $accept, 413, 'too_large');
expect(array_replace($baseServer, ['CONTENT_TYPE' => 'application/json']), $basePost, 'mail', $accept, 415, 'unsupported_type');
expect($baseServer, array_replace($basePost, ['form-name' => 'random']), 'mail', $accept, 400, 'invalid_form');
expect($baseServer, array_replace($basePost, ['form-name' => '']), 'mail', $accept, 400, 'invalid_form');
expect($baseServer, array_replace($basePost, ['email' => 'wrong']), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['email' => "reader@example.com\r\nBcc: bad@example.com"]), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['name' => "Reader\nX-Extra: yes"]), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['message' => ' ']), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['email' => ['reader@example.com']]), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['message' => "bad\x00value"]), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['name' => "\xC3\x28"]), 'mail', $accept, 400, 'invalid_input');
expect($baseServer, array_replace($basePost, ['name' => str_repeat('a', 121)]), 'mail', $accept, 413, 'too_large');
expect($baseServer, array_replace($basePost, ['message' => str_repeat('m', 8001)]), 'mail', $accept, 413, 'too_large');
expect($baseServer, array_replace($basePost, ['message' => str_repeat('m', 8000)]), 'disabled', $accept, 503, 'delivery_unavailable');

// Regression: URLSearchParams-style UTF-8 encoding expands valid 7,800-byte
// text beyond the former 16 KiB wire limit. Exercise the encoded round trip.
$unicodePost = array_replace($basePost, ['message' => str_repeat('龍', 2600)]);
$encodedUnicode = http_build_query($unicodePost, '', '&', PHP_QUERY_RFC1738);
parse_str($encodedUnicode, $decodedUnicode);
check(strlen($unicodePost['message']) === 7800, 'Regression fixture has 7,800 UTF-8 bytes');
check(strlen($encodedUnicode) > 16384 && strlen($encodedUnicode) < 32768, 'Encoded fixture exercises expanded request size');
expect(array_replace($baseServer, ['CONTENT_LENGTH' => strlen($encodedUnicode)]), $decodedUnicode, 'mail', $accept, 200, 'message_accepted');
check(strpos($calls[count($calls) - 1]['body'], $unicodePost['message']) !== false, 'Valid Unicode message reaches simulated transport intact');

expect(array_replace($baseServer, ['HTTP_ORIGIN' => 'https://evil.example']), $basePost, 'mail', $accept, 403, 'origin_not_allowed');
expect(array_replace($baseServer, ['HTTP_ORIGIN' => 'https://falbeybooks.com.evil.example']), $basePost, 'mail', $accept, 403, 'origin_not_allowed');
expect(array_replace($baseServer, ['HTTP_ORIGIN' => 'http://falbeybooks.com']), $basePost, 'mail', $accept, 403, 'origin_not_allowed');
expect(array_replace($baseServer, ['HTTP_SEC_FETCH_SITE' => 'cross-site']), $basePost, 'mail', $accept, 403, 'origin_not_allowed');
expect(array_replace($baseServer, ['HTTP_ORIGIN' => 'https://www.falbeybooks.com']), $basePost, 'disabled', $accept, 503, 'delivery_unavailable');
expect(array_replace($baseServer, ['HTTP_ORIGIN' => '']), $basePost, 'disabled', $accept, 503, 'delivery_unavailable');
$local = array_replace($baseServer, ['HTTP_ORIGIN' => 'http://127.0.0.1:4175', 'HTTP_HOST' => '127.0.0.1:4175', 'REMOTE_ADDR' => '127.0.0.1']);
expect($local, $basePost, 'disabled', $accept, 503, 'delivery_unavailable');
expect(array_replace($local, ['REMOTE_ADDR' => '192.0.2.7']), $basePost, 'disabled', $accept, 403, 'origin_not_allowed');
expect(array_replace($local, ['HTTP_HOST' => 'falbeybooks.com']), $basePost, 'disabled', $accept, 403, 'origin_not_allowed');

check(!is_file(__DIR__ . '/../public/form-submissions.txt'), 'No public submission log created');
fwrite(STDOUT, 'PASS: ' . $count . " checks; no real email sent.\n");
