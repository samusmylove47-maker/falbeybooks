<?php
declare(strict_types=1);

/**
 * Falbey Books contact / manual newsletter-request endpoint.
 * PHP 7.4+. No submissions are written to the public directory or to a log.
 * Enable hosting delivery explicitly with FALBEY_FORM_TRANSPORT=mail.
 * See ../implementation/forms-README.md (not a public asset).
 */
function falbey_result(int $status, string $code, string $message): array
{
    return ['status' => $status, 'body' => [
        'ok' => $status >= 200 && $status < 300,
        'code' => $code,
        'message' => $message,
    ]];
}

function falbey_origin_allowed(array $server): bool
{
    // Reject browser submissions from unrelated sites. Host spam controls may
    // still be needed: an arbitrary client can omit or forge request headers.
    if (($server['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        return false;
    }
    $origin = $server['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return true; // Older browsers / ordinary same-site POSTs may omit Origin.
    }
    if (!is_string($origin)) {
        return false;
    }
    if (in_array($origin, ['https://falbeybooks.com', 'https://www.falbeybooks.com'], true)) {
        return true;
    }
    // Local preview exception only for an actual loopback host and connection.
    $host = $server['HTTP_HOST'] ?? '';
    $address = $server['REMOTE_ADDR'] ?? '';
    return is_string($host)
        && in_array($address, ['127.0.0.1', '::1'], true)
        && preg_match('/\A(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?\z/i', $host) === 1
        && $origin === 'http://' . $host;
}

/**
 * The injected transport lets CLI tests simulate acceptance/failure without
 * invoking PHP mail() or saving any reader data.
 */
function falbey_handle(array $server, array $post, string $transport, callable $send): array
{
    if (($server['REQUEST_METHOD'] ?? '') !== 'POST') {
        return falbey_result(405, 'method_not_allowed', 'Please submit the form using its Send button.');
    }
    if (!falbey_origin_allowed($server)) {
        return falbey_result(403, 'origin_not_allowed', 'Please submit the form from falbeybooks.com.');
    }
    // URL-encoded UTF-8 can use three wire bytes per input byte. Leave room
    // for a valid 8,000-byte message plus the remaining fields and encoding.
    if ((int) ($server['CONTENT_LENGTH'] ?? 0) > 32768) {
        return falbey_result(413, 'too_large', 'This submission is too long. Please shorten it and try again.');
    }
    $type = strtolower(trim(explode(';', (string) ($server['CONTENT_TYPE'] ?? ''))[0]));
    if (!in_array($type, ['application/x-www-form-urlencoded', 'multipart/form-data'], true)) {
        return falbey_result(415, 'unsupported_type', 'Please send this request using the website form.');
    }
    $limits = ['form-name' => 40, 'name' => 120, 'email' => 254, 'message' => 8000, 'bot-field' => 500];
    $values = [];
    foreach ($limits as $field => $limit) {
        $value = $post[$field] ?? '';
        if (!is_string($value) || preg_match('//u', $value) !== 1) {
            return falbey_result(400, 'invalid_input', 'Please check the form fields and try again.');
        }
        if (strlen($value) > $limit) {
            return falbey_result(413, 'too_large', 'A form field is too long. Please shorten it and try again.');
        }
        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
            return falbey_result(400, 'invalid_input', 'Please remove unsupported characters and try again.');
        }
        $values[$field] = trim($value);
    }
    $form = $values['form-name'];
    if (!in_array($form, ['newsletter', 'contact'], true)) {
        return falbey_result(400, 'invalid_form', 'Please use the newsletter or contact form on this website.');
    }
    // A filled hidden field is an automated request. Acknowledge without sending
    // or storing anything; this never claims newsletter enrollment.
    if ($values['bot-field'] !== '') {
        return falbey_result(200, 'request_received', 'Your request has been received.');
    }
    $name = $values['name'];
    $email = $values['email'];
    $message = $values['message'];
    if (preg_match('/[\r\n]/', $name . $email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return falbey_result(400, 'invalid_input', 'Please enter a valid email address and a name on one line.');
    }
    if ($form === 'contact' && $message === '') {
        return falbey_result(400, 'invalid_input', 'Please enter your message.');
    }
    if ($transport !== 'mail') {
        return falbey_result(503, 'delivery_unavailable', 'The form is temporarily unavailable. Please email wayne@falbeygroup.com.');
    }

    $subject = $form === 'newsletter' ? 'Newsletter subscription request' : 'Website contact message';
    $body = 'A ' . ($form === 'newsletter' ? 'newsletter subscription request' : 'contact message')
        . " from falbeybooks.com\n\n"
        . 'Name: ' . ($name === '' ? '(not given)' : $name) . "\n"
        . 'Email: ' . $email . "\n"
        . 'Submitted: ' . gmdate('Y-m-d H:i:s') . " UTC\n\n";
    if ($form === 'newsletter') {
        $body .= "This is a subscription request only. The website has not enrolled this reader in a mailing list.\n"
            . "Confirm enrollment through the author's mailing service and its normal consent/unsubscribe process.\n";
    } else {
        $body .= "Message:\n" . str_replace(["\r\n", "\r"], "\n", $message) . "\n";
    }
    // Only the validated Reply-To header contains visitor input. Recipient,
    // sender, subject and envelope options are never supplied by the visitor.
    $headers = [
        'From' => 'Falbey Books <noreply@falbeybooks.com>',
        'Reply-To' => $email,
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => '8bit',
    ];
    try {
        $accepted = $send('wayne@falbeygroup.com', $subject, $body, $headers) === true;
    } catch (Throwable $error) {
        // Do not expose or log exception text or submission data.
        $accepted = false;
    }
    if (!$accepted) {
        return falbey_result(503, 'delivery_unavailable', 'The form could not send your request. Please email wayne@falbeygroup.com.');
    }
    // PHP mail() acceptance is not a delivery receipt or list enrollment.
    return $form === 'newsletter'
        ? falbey_result(200, 'request_received', 'Your subscription request has been accepted for delivery to the author. You are not yet enrolled; please wait for confirmation.')
        : falbey_result(200, 'message_accepted', 'Your message has been accepted for delivery to the author. Thank you.');
}

// The separate CLI harness defines this constant before requiring the file.
// An HTTP request, query string or environment variable cannot enable test mode.
if (PHP_SAPI === 'cli' && defined('FALBEY_FORMS_TEST_MODE') && FALBEY_FORMS_TEST_MODE === true) {
    return;
}

$result = falbey_handle($_SERVER, $_POST, (string) (getenv('FALBEY_FORM_TRANSPORT') ?: 'disabled'),
    static function (string $to, string $subject, string $body, array $headers): bool {
        return @mail($to, $subject, $body, $headers);
    }
);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if ($result['status'] === 405) {
    header('Allow: POST');
}
http_response_code($result['status']);
echo json_encode($result['body'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

