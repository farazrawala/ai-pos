<?php
/**
 * Webhook: capture all request parameters and email them via Gmail SMTP.
 *
 * Examples:
 *   GET  /webhook.php?order_id=123&status=shipped
 *   POST /webhook.php  (form-urlencoded, multipart, or JSON body)
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Gmail SMTP configuration
$smtpHost = 'ssl://smtp.gmail.com';
$smtpPort = 465;
$smtpUser = 'travisarthurkdp@gmail.com';
$smtpPass = 'mbkr dngi cbzt elvr';

$mailTo = 'faraz.rawala@gmail.com';
$mailFrom = $smtpUser;
$mailFromName = 'AI POS Webhook';

try {
    $payload = collectWebhookPayload();
    $subject = buildEmailSubject($payload);
    $body = buildEmailBody($payload);

    sendSmtpMail(
        $smtpHost,
        $smtpPort,
        $smtpUser,
        $smtpPass,
        $mailFrom,
        $mailFromName,
        $mailTo,
        $subject,
        $body
    );

    echo json_encode([
        'success' => true,
        'message' => 'Webhook received and email sent.',
        'sent_to' => $mailTo,
        'captured' => [
            'method' => $payload['method'],
            'get_count' => count($payload['get']),
            'post_count' => count($payload['post']),
            'json_keys' => array_keys($payload['json'] ?? []),
            'query_string' => $payload['query_string'],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to process webhook / send email.',
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

/**
 * Collect GET, POST, raw/JSON body, headers, and server meta.
 */
function collectWebhookPayload(): array
{
    $rawBody = file_get_contents('php://input');
    $json = null;
    if (is_string($rawBody) && $rawBody !== '') {
        $decoded = json_decode($rawBody, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $json = $decoded;
        }
    }

    $headers = [];
    if (function_exists('getallheaders')) {
        $headers = getallheaders() ?: [];
    } else {
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
                $headers[$name] = $value;
            }
        }
    }

    return [
        'received_at' => date('c'),
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
        'url' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
            . '://'
            . ($_SERVER['HTTP_HOST'] ?? 'localhost')
            . ($_SERVER['REQUEST_URI'] ?? '/webhook.php'),
        'query_string' => $_SERVER['QUERY_STRING'] ?? '',
        'content_type' => $_SERVER['CONTENT_TYPE'] ?? ($headers['Content-Type'] ?? ''),
        'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'get' => $_GET,
        'post' => $_POST,
        'files' => summarizeUploadedFiles($_FILES),
        'json' => $json,
        'raw_body' => $rawBody === false ? '' : $rawBody,
        'headers' => $headers,
        'all_request' => $_REQUEST,
    ];
}

function summarizeUploadedFiles(array $files): array
{
    $out = [];
    foreach ($files as $field => $file) {
        if (is_array($file['name'] ?? null)) {
            $out[$field] = [];
            foreach ($file['name'] as $i => $name) {
                $out[$field][] = [
                    'name' => $name,
                    'type' => $file['type'][$i] ?? '',
                    'size' => $file['size'][$i] ?? 0,
                    'error' => $file['error'][$i] ?? null,
                ];
            }
        } else {
            $out[$field] = [
                'name' => $file['name'] ?? '',
                'type' => $file['type'] ?? '',
                'size' => $file['size'] ?? 0,
                'error' => $file['error'] ?? null,
            ];
        }
    }
    return $out;
}

function buildEmailSubject(array $payload): string
{
    $method = $payload['method'] ?? 'REQ';
    $hint = '';
    foreach (['event', 'type', 'status', 'order_id', 'orderId', 'id'] as $key) {
        if (!empty($payload['get'][$key])) {
            $hint = ' · ' . $key . '=' . substr((string) $payload['get'][$key], 0, 40);
            break;
        }
        if (!empty($payload['post'][$key])) {
            $hint = ' · ' . $key . '=' . substr((string) $payload['post'][$key], 0, 40);
            break;
        }
        if (!empty($payload['json'][$key]) && is_scalar($payload['json'][$key])) {
            $hint = ' · ' . $key . '=' . substr((string) $payload['json'][$key], 0, 40);
            break;
        }
    }
    return '[Webhook] ' . $method . $hint . ' · ' . date('Y-m-d H:i:s');
}

function buildEmailBody(array $payload): string
{
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        $json = print_r($payload, true);
    }

    return "AI POS webhook received a request.\n\n"
        . "Time: {$payload['received_at']}\n"
        . "Method: {$payload['method']}\n"
        . "URL: {$payload['url']}\n"
        . "Remote IP: {$payload['remote_addr']}\n"
        . "Content-Type: {$payload['content_type']}\n\n"
        . "========== FULL PAYLOAD ==========\n"
        . $json
        . "\n";
}

/**
 * Minimal SMTP client (AUTH LOGIN over SSL) — no Composer/PHPMailer required.
 */
function sendSmtpMail(
    string $host,
    int $port,
    string $username,
    string $password,
    string $fromEmail,
    string $fromName,
    string $toEmail,
    string $subject,
    string $body
): void {
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client(
        "{$host}:{$port}",
        $errno,
        $errstr,
        30,
        STREAM_CLIENT_CONNECT,
        stream_context_create([
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
                'allow_self_signed' => false,
            ],
        ])
    );

    if (!$socket) {
        throw new RuntimeException("SMTP connect failed: {$errstr} ({$errno})");
    }

    stream_set_timeout($socket, 30);

    $expect = static function ($sock, array $codes, string $step) {
        $response = '';
        while (($line = fgets($sock, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new RuntimeException("SMTP {$step} failed ({$code}): " . trim($response));
        }
        return $response;
    };

    $send = static function ($sock, string $command) {
        fwrite($sock, $command . "\r\n");
    };

    $expect($socket, [220], 'banner');
    $send($socket, 'EHLO localhost');
    $expect($socket, [250], 'EHLO');

    $send($socket, 'AUTH LOGIN');
    $expect($socket, [334], 'AUTH LOGIN');
    $send($socket, base64_encode($username));
    $expect($socket, [334], 'AUTH USER');
    $send($socket, base64_encode($password));
    $expect($socket, [235], 'AUTH PASS');

    $send($socket, 'MAIL FROM:<' . $fromEmail . '>');
    $expect($socket, [250], 'MAIL FROM');
    $send($socket, 'RCPT TO:<' . $toEmail . '>');
    $expect($socket, [250, 251], 'RCPT TO');
    $send($socket, 'DATA');
    $expect($socket, [354], 'DATA');

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $encodedFromName = '=?UTF-8?B?' . base64_encode($fromName) . '?=';
    // Dot-stuffing for SMTP DATA
    $safeBody = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $body));
    $safeBody = str_replace("\n", "\r\n", $safeBody);

    $message = '';
    $message .= 'Date: ' . date('r') . "\r\n";
    $message .= 'From: ' . $encodedFromName . ' <' . $fromEmail . ">\r\n";
    $message .= 'To: <' . $toEmail . ">\r\n";
    $message .= 'Subject: ' . $encodedSubject . "\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: 8bit\r\n";
    $message .= "\r\n";
    $message .= $safeBody;
    $message .= "\r\n.";

    $send($socket, $message);
    $expect($socket, [250], 'message body');
    $send($socket, 'QUIT');
    fclose($socket);
}
