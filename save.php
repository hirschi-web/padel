<?php
// Empfange JSON Daten vom POST Request
$json = file_get_contents('php://input');

if($json) {
    // Speichere die Daten in data.txt
    file_put_contents('data.txt', $json);
    echo "OK";
} else {
    echo "Keine Daten empfangen";
}
?>
