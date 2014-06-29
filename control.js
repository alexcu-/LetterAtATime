// initial document ready
$(document).ready(init);
// leaving page?
window.onbeforeunload = uninit;

function init()
{
    // set inital states
    setEnabledState($("#storyContent"), false);
    
    // set callbacks
    setEventHandler($("#generateStoryID"), "click", function() { startNewStory() });
    setEventHandler($("#storyIDInput"), "change", function() { setStoryID(this.value) });
    setEventHandler($("#storyContent"), "keyup", function(e) { addToStory(e) });
    
    // disallow movement of cursor
    setEventHandler($("#storyContent"), "keydown", function() { setStoryCursorToEnd() });
    setEventHandler($("#storyContent"), "click", function() { setStoryCursorToEnd() });

    // notifications on my turn
    window.addEventListener("visibilitychange", function(){ myTurnNotification() }, false);
    
    // prevent copy and paste into story content
    $('#storyContent').bind('cut paste', function(event) {
        event.preventDefault();
    });
}

function uninit()
{
    // if was in game
    if (window.storyID !== false)
    {
        xhr = newXHR("action=leaveStory&storyID="+window.storyID+"&playerID="+window.playerID, function(){});
    }
}

function setEventHandler(el, evt, func)
{
    el[0].addEventListener(evt, func, false);
}

function setEnabledState(el, isOn)
{
    el[0].disabled = !isOn;
    el[0].focus();
}

function startNewStory()
{
    // disable input for story id and the button
    setEnabledState($("#storyIDInput"), false);
    setEnabledState($("#generateStoryID"), false);
    
    var xhr = newXHR("action=newStory", function(){
        var responseData = JSON.parse(xhr.responseText);
        // setup the player id
        window.playerID = responseData.player.id;
        var isMyTurn = window.playerID == responseData.story.whoseTurnID;
        // setup the game
        setupGame(responseData.story.id, isMyTurn);  
    });
}

function setStoryID(storyID)
{
    // disable input for story id and the button
    setEnabledState($("#storyIDInput"), false);
    setEnabledState($("#generateStoryID"), false);
        
    // send xhr - send setup request
    var xhr = newXHR("action=joinStory&storyID="+storyID, function(){
        var responseData = JSON.parse(xhr.responseText);
        // json response is in error
        if (responseData.error != "OK")
        {
            setupStoryFailed();
        }
        else
        {
            // setup the player id
            window.playerID = responseData.player.id;
            var isMyTurn = window.playerID == responseData.story.whoseTurnID;
            // setup the game
            setupGame(responseData.story.id, isMyTurn);            
        }
    });
}

function setupStoryFailed()
{
    alert("No games with that id.");
    setEnabledState($("#storyIDInput"), true);
}

window.storyID = false;
function setupGame(storyID, isMyTurn)
{
    // display the story id on screen
    window.storyID = storyID;
    $("#storyIDValue").html(window.storyID);
    // if my turn then set the turn status and allow input to story
    if (isMyTurn)
    {
        // allow story if my turn
        setEnabledState($("#storyContent"), true);
        // set status to active
        setTurnStatus(true);
    }
    else
    {
        // Initiate timeout for checking feedback
        window.checkForUpdatesTimer = setInterval(function () { checkForStoryUpdates() }, 1000);
        // set status to inactive
        setTurnStatus(false);
    }
}

// disallow alpha global
window.oldStory = "";
window.undoStory = "";
window.disallowAlphaChar = false;
function addToStory(e)
{
    // set old story element
    var storyEl = $("#storyContent")[0];

    // Enter or backspace was pressed?
    var code = (e.keyCode ? e.keyCode : e.which);
    // not shift-entering
    var didEnter = code == 13 && !e.shiftKey;
    var didBackspace = code == 8;
    var didTab = code == 9;
    
    if (didEnter)
    {
        // kill last char (i.e., \n)
        storyEl.value = storyEl.value.substr(0, storyEl.value.length-1);
        // only commit changes if changes between current and old story
        if (window.oldStory != storyEl.value && storyEl.value.length != 0)
        {
            // update old story to current story
            window.oldStory = storyEl.value;
            sendLatestContent();
        }
    }
    
    if (didTab)
    {
        // disable tab to focus
        e.preventDefault();
        // add a tab char to the value
        storyEl.value += "\t";
    }
    
    // ensure caps
    storyEl.value = storyEl.value.toUpperCase();
    
    // same content or backspacing? just dismiss
    if (window.undoStory == storyEl.value) return;

    // === le magic

    // check if non punctual content added or single character
    var latestChar = storyEl.value[storyEl.value.length-1];
    var alphaRegEx = /[A-z]/;
    // not adding an alpha if backspacing to previous!
    var alphaAdded = alphaRegEx.test(latestChar) && !didBackspace;

    // trying to backspace and not added their char
    if (didBackspace && !window.disallowAlphaChar)
    {
        // undo changes made
        storyEl.value = window.undoStory;
    }

    // trying to add another alpha char when already added char?
    if (window.disallowAlphaChar && alphaAdded)
    {
        // undo changes made
        storyEl.value = window.undoStory;
    }
    
    // just adding an alpha?
    if (alphaAdded)
    {
        // added a char! disallow entry
        window.disallowAlphaChar = true;
        // update old story
        window.undoStory = storyEl.value;
    }
    // Else punctuation added
    else
    {
        // If alpha has already been added and not backspacing, undo
        if (window.disallowAlphaChar && !didBackspace)
        {
            // undo changes made
            storyEl.value = window.undoStory;
        }
    }
    
    // Just backspacing
    if (didBackspace)
    {
        window.disallowAlphaChar = false;
        window.undoStory = storyEl.value;
    }
}

function sendLatestContent()
{
    var content = $("#storyContent")[0].value;
    // disable further additions
    setEnabledState($("#storyContent"), false);
    // set status to inactive
    setTurnStatus(false);
    // Send story request
    var xhr = newXHR("action=addToStory&storyID="+window.storyID+"&content="+content, function(){
        // reaffirm...
        var responseData = JSON.parse(xhr.responseText);
        $("#storyContent")[0].value = responseData.story.content;
        // Keep checking for further additions
        window.checkForUpdatesTimer = setInterval(function () { checkForStoryUpdates() }, 1000);
    });
}

function checkForStoryUpdates()
{
    var xhr = newXHR("action=checkUpdates&storyID="+window.storyID, function(){
       var responseData = JSON.parse(xhr.responseText);
       // update story content where
       $("#storyContent")[0].value = responseData.story.content;
       // change turn
       if (responseData.story.whoseTurnID == window.playerID)
       {
            var storyEl = $("#storyContent")[0];
            // enable story additions
            setEnabledState($("#storyContent"), true);
            // set cursor to end
            setStoryCursorToEnd();
            // reset window addedChar (i.e., allow entry)
            window.disallowAlphaChar = false;
            window.undoStory = window.oldStory = storyEl.value;
            // cancel timeout
            clearInterval(window.checkForUpdatesTimer);
            // set status to active
            setTurnStatus(true);
            // window isn't open?
            var isWindowNotOpen = document.hidden;
            if (isWindowNotOpen)
                // flash the title
                flashTitle();
       }
    });
}

function myTurnNotification()
{
    // window is now open?
    var isWindowOpen = !document.hidden;
    
    // window open and now my turn
    if (isWindowOpen && window.myTurn)
    {
        // disable the flashTitleTimer if exists
        if (window.flashTitleTimer !== false)
        {
            clearInterval(window.flashTitleTimer);
            // ensure title is at default if changed
            window.document.title = window.originalTitle;
        }
    }
}

window.flashTitleTimer = false;
function flashTitle()
{
    window.originalTitle = window.document.title;
    window.flashTitleTimer = window.setInterval(function() { 
        window.document.title = window.document.title == "(!) Your Turn" ? window.originalTitle : "Your Turn!";
    }, 1000);
}

function setStoryCursorToEnd()
{
    var storyEl = $("#storyContent")[0];
    setCaretToPos(storyEl, storyEl.value.length);
}

function setTurnStatus(status)
{
    if (status == true)
    {
        $("#status").addClass("label-success");
        $("#status").removeClass("label-danger");
        $("#status").html("Your turn!");
        window.myTurn = true;
    }
    else
    {
        $("#status").removeClass("label-success");
        $("#status").addClass("label-danger");
        $("#status").html("Not your turn!");
        window.myTurn = false;
    }
}

function newXHR(params, callback)
{
    var xhr = window.XMLHttpRequest ? new XMLHttpRequest : new ActiveXObject("Microsoft.XMLHTTP");
    xhr.open("POST", "./letter.php", true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function() 
    { 
        if (xhr.readyState == 4 && xhr.status == 200)
        {
            callback();
        }
    };
    xhr.send(params);
    return xhr;
}

//===== borrowed functions
function setSelectionRange(input, selectionStart, selectionEnd) {
  if (input.setSelectionRange) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  }
  else if (input.createTextRange) {
    var range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', selectionEnd);
    range.moveStart('character', selectionStart);
    range.select();
  }
}

function setCaretToPos(input, pos) {
  setSelectionRange(input, pos, pos);
}