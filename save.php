<?php
$json = file_get_contents('php://input');
if($json) {
    file_put_contents('data.txt', $json);
    echo "Saved";
}
?>
