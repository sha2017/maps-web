<?php

$handle = str_replace(array("&", "?", "'", "\""), "", $_GET["handle"]);

$wikiUrl = "https://orga.sha2017.org";

echo file_get_contents($wikiUrl . "/api.php?action=askargs&conditions=Handle::0x" . $handle . "&printouts=Summary&format=json");
