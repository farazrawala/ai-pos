<?php
// Hosting info for the header version badge tooltip. Deployed with the static build.
header('Content-Type: application/json');
header('Cache-Control: no-store');

$ip = $_SERVER['SERVER_ADDR'] ?? $_SERVER['LOCAL_ADDR'] ?? gethostbyname(gethostname());

echo json_encode([
    'ip' => $ip,
    'host' => gethostname(),
]);
