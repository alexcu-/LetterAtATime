<?php
  
function new_story(&$stories)
{
    // generate a story id
    $ret["story"]["id"         ] = sha1(mt_rand() * time());
    // initially first player is the player whose turn it is
    $ret["story"]["whoseTurn"  ] = 0;
    // only one player initially
    $ret["story"]["playerCount"] = 1;
    // no content initially
    $ret["story"]["content"    ] = "";
    
    // generate player info
    $ret["player"]["id"] = sha1(mt_rand() * time());
    
    // set the 0'th player to this id
    $ret["story"]["players"][0] = $ret["player"]["id"];
    
    // set whoseturn id it is
    $ret["story"]["whoseTurnID"] = $ret["story"]["players"][$ret["story"]["whoseTurn"]];
    
    // add this to stories under the key
    $stories[$ret["story"]["id"]] = $ret["story"];
    
    return $ret;
}

function join_story($id, &$stories)
{
    // first check we have a id by this id in stories
    if (!array_key_exists($id, $stories))
        return false;
    
    // if there is, then pull out info
    $story = &$stories[$id];
    
    // now add a new player
    $story["playerCount"]++;
    
    // generate new player id
    $ret["player"]["id"] = sha1(mt_rand() * time());
    
    // set the n'th-1 player to this id
    $story["players"][$story["playerCount"]-1] = $ret["player"]["id"];
    
    // return the story
    $ret["story"] = $story;
    
    return $ret;
}

function add_to_story($id, $content, &$stories)
{
    // first check we have a id by this id in stories
    if (!array_key_exists($id, $stories))
        return false;
        
    // if there is, then pull out info
    $story = &$stories[$id];
    
    // update content
    $story["content"] = $content;
    
    // move onto the next player or loop back to first player
    $story["whoseTurn"] = $story["whoseTurn"] >= $story["playerCount"] - 1 ? 0 : $story["whoseTurn"] += 1;
    
    // set whoseturn id it is now
    $story["whoseTurnID"] = $story["players"][$story["whoseTurn"]];
    
    // return values
    $ret["story"] = $story;
    
    return $ret;
}

function check_updates($id, &$stories)
{
    // first check we have a id by this id in stories
    if (!array_key_exists($id, $stories))
        return false;
        
    // story exists; just return latest info on that story
    $ret["story"] = $stories[$id];
    
    return $ret;
}

function leave_story($id, $playerID, &$stories)
{
    // first check we have a id by this id in stories
    if (!array_key_exists($id, $stories))
        return false;
     
    $story = &$stories[$id];
        
    // story exists... but does the player?
    if ($playerIdx = array_search($playerID, $story["players"]))
    {
        // player was in this story... remove them from the array and reduce the playerCount
        unset($story["players"][$playerIdx]);
        $story["players"] = array_values($story["players"]);
        $story["playerCount"]--;
        
        // update whose turn it is if it was my turn
        if ($playerID == $story["whoseTurnID"])
        {
            $story["whoseTurn"] = $story["whoseTurn"] >= $story["playerCount"] - 1 ? 0 : $story["whoseTurn"] += 1;
    
            // set whoseturn id it is now
            $story["whoseTurnID"] = $story["players"][$story["whoseTurn"]];
        }
    }
    else 
        return false;
}

//==== Start here ====

if (isset($_POST["action"]))
{
    $didFetchStories = false;
    $stories = apc_fetch("stories", $didFetchStories);

    // nothing loaded? new array
    if (!$didFetchStories)
        $stories = array();
        
    $action = $_POST["action"];
    $ret = false;
    
    switch ($action)
    {
        case "newStory":
        {
            $ret = new_story($stories);
            break;
        }
        case "joinStory":
        {
            if (isset($_POST["storyID"]))
                $ret = join_story($_POST["storyID"], $stories);
            break;
        }
        case "addToStory":
        {
            if (isset($_POST["storyID"]) && isset($_POST["content"]))
                $ret = add_to_story($_POST["storyID"], $_POST["content"], $stories);
            break;
        }
        case "checkUpdates":
        {
            if (isset($_POST["storyID"]))
                $ret = check_updates($_POST["storyID"], $stories);
            break;
        }
        case "leaveStory":
        {
            if (isset($_POST["storyID"]) && isset($_POST["playerID"]))
                $ret = leave_story($_POST["storyID"], $_POST["playerID"], $stories);
            break;
        }
    }
    
    // on error
    if ($ret === false)
    {
        $ret["error"] = "Failed to perform action: $action";
    }
    else
    {
        $ret["error"] = "OK";   
    }
    
    // Update store
    apc_store("stories", $stories);

    // echo json'ified result
    echo json_encode($ret);
}
// admin stuff...
else if (isset($_GET["invalidate"]))
{
    $result = 0;
    $result += apc_delete("stories");
    die ("deleted $result files");
}
else if (isset($_GET["data"]))
{
    $didFetchStories = false;
    $stories = apc_fetch("stories", $didFetchStories);

    // nothing loaded? new array
    if (!$didFetchStories)
        $stories = array();
        
    echo "<pre>";
    echo "Stories: ";
    print_r($stories);
    echo "</pre>";
}

// ==== cache functions ===

// custom apc_fetch, store and delete
function apc_fetch($key, &$didFetch)
{
    $path = dirname(__FILE__);
    $filename = $path."/$key";
    if (file_exists($filename))
    {
        $didFetch = true;
        return unserialize(file_get_contents($key));
    }
    else $didFetch = false;
    return NULL;
}

function apc_store($key, array &$toStore, $ttl = false)
{
    // delete store if > ttl
    if ($ttl !== false)
    {
        $path = dirname(__FILE__);
        $filename = $path."/$key";
        if (file_exists($filename) && (time()-filectime($filename)) < $ttl)
        {
            unlink($filename);
        }
    }
    file_put_contents($key, serialize( $toStore ));
}

function apc_delete($key)
{
    $path = dirname(__FILE__);
    $filename = $path."/$key";
    if (file_exists($filename))
    {
        unlink($filename);
        return true;
    }
    else
        return false;
}
?>