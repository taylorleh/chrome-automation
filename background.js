var responseQ = [];
var recording = false;
var playing = false;

var LLDecorator = {
  attachToTail: function (frag){
    this._asArray = this._asArray.concat(frag._asArray);
    var newTail = frag.tail;
    this.size += frag.size;

    // traversal
    var front = this.head;
    while (front.next) {
      front = front.next
    }

    front.next = frag.head;
    this.tail = frag.tail;

  },

  saveFragment: function (frag){
    var count = Object.keys(this.pageFragments).length + 1;
    this.pageFragments[count] = frag._asArray;
  }
};

var RecordingsModule = (function (){
  var pages = {};              // hash of urls and LL recordings
  var currentRecording = null; // linked List of current (in progress) recording
  var initialPage = null; // url of starting page of recording so can append after
  var ongoingFragIndex = 0; // for multi page automations - keeps track of which LL fragment to send on page load
  var currentPlayback = null; // set after ui starts playback on first page.

  
  return {
    append: function (fragment){
      if (currentRecording) { // append to current automation fragment
        LLDecorator.saveFragment.call(currentRecording, fragment.cache);
        LLDecorator.attachToTail.call(currentRecording, fragment.cache);
      } else if (initialPage && !currentRecording) { // first fragment to add to LL recording
        currentRecording = fragment.cache;
        LLDecorator.saveFragment.call(currentRecording, fragment.cache);
      } else { // no initial page set and current fragments
      }
    },

    begin: function (url){
      if (!initialPage && !currentRecording) {
        initialPage = url;
      } else {
      }
    },

    showBuilt: function (){
    },

    build: function (){
      currentRecording.totalFragments = Object.keys(currentRecording.pageFragments).length;
      pages[initialPage] = currentRecording;
      currentRecording = null;
      initialPage = null;
    },

    getOngoingFragment: function (url){
      var pageAutomations;

      if (url && !playing) { // initial playback, return first fragment
        ongoingFragIndex = 0;
        playing = true;
        if (pageAutomations = pages[url]) {
          currentPlayback = pageAutomations;
          var firstFrag = pageAutomations.pageFragments[ongoingFragIndex += 1];
          return firstFrag;
        }
      } else if (currentPlayback) {
        if (ongoingFragIndex > currentPlayback.totalFragments) {
          playing = false;
          currentPlayback = null;
          return currentPlayback;
        }

        var returnFrag = currentPlayback.pageFragments[ongoingFragIndex += 1];
        return returnFrag;
      }
    },
    _internal: 0

  };
}());


var MESSAGE_FLOWS = {
  'RECORD': {
    'ACCEPT': 'Recording Started!',
    'IN_PROGRESS': 'Recording already in progress. Please start a new recording',
    'DEFAULT': 'Click record to start a new recording'
  },
  'PLAYBACK': {
    'RUNNING': 'Playback Started',
    'IN_PROGRESS': 'Playback already in progress'
  }
};

var INBOX = {
  EXTENSION: { // messages received from the extension (popup.js) invoked by user interaction
    STATE_REQUEST: function (request, sender, sendResponse){
      if (recording && !playing) {
        sendResponse({
          value: MESSAGE_FLOWS.RECORD.ACCEPT
        })
      } else if (playing && !recording) {
      } else if (!recording && !playing) {
        sendResponse({
          value: MESSAGE_FLOWS.RECORD.DEFAULT
        })
      } else {
      }
    },

    STOP: function (request, sender, sendResponse){
      messageContentScript({message: 'STOP'}, function (csresp){
        recording = false;
        playing = false;
        if (csresp.details) { // check if there were any actions on the page where 'stop' was clicked
          RecordingsModule.append(csresp.details);
        }
        RecordingsModule.showBuilt();
        RecordingsModule.build();
        sendResponse({
          value: MESSAGE_FLOWS.RECORD.DEFAULT
        })

      });
    },

    PLAYBACK: function (request, sender, sendResponse){
      if (playing || recording) {
        sendResponse({
          value: MESSAGE_FLOWS.PLAYBACK.IN_PROGRESS
        });
        return;
      } else {
        sendResponse({
          message: MESSAGE_FLOWS.PLAYBACK.RUNNING
        });
      }


      getPageUrl(function (tab){
        var frag = RecordingsModule.getOngoingFragment(tab.url);
        if (!frag) {
        }
        messageContentScript({
          message: 'PLAYBACK',
          details: frag
        });
      })
    },

    RECORD: function (request, sender, sendResponse){
      var responseHandler = csResponse(request);
      recording = true;
      messageContentScript({message: 'RECORD'}, function (response, reply){
        reply && (responseQ.push(sendResponse)) && reply(response);

        if (response.message === 'ACCEPT') { // if content script accepts
          RecordingsModule.begin(response.location);

        } else { // else if content script denies

        }


      });
      return true;

    }
  },
  CONTENT_SCRIPT: {
    STATE_REQUEST: function (request, sender, sendResponse){

      var state = 'DEFAULT';
      if (recording && !playing) {
        state = 'RECORDING';
      } else if (playing && !recording) {
        var frag = RecordingsModule.getOngoingFragment();
        state = 'PLAYING';
        if (!frag) {
        }
      }

      sendResponse({
        value: state,
        details: frag || null
      }, function (){
      });
    },
    UNLOAD: function (request, sender, sendResponse){
      // pages[request.location.href] = request.details;
      RecordingsModule.append(request.details);
    }
  }
};


var csResponse = function (outbox){
  var action = outbox.message
    , validResponses = MESSAGE_FLOWS[action];

  return function (inbox){
    var messageToPopup;

    try {
      messageToPopup = validResponses[inbox.message];
    } catch (e) {
      messageToPopup = 'ERROR: Did not receive response from script!';
    }

    responseQ.shift()({
      value: messageToPopup,
      classes: 'green'
    });
  }
};


// to send message to content script, we must first query the tab
var messageContentScript = function (msg, cb){

  var responseHandler = csResponse(msg);

  chrome.tabs.query({active: true}, function (tabs){
    chrome.tabs.sendMessage(tabs[0].id, msg, function (response){
      if (!cb) {
        responseHandler(response);
      } else if (cb) {
        cb(response, responseHandler);
      }
    });

  });
};

var getPageUrl = function (cb){
  chrome.tabs.getSelected(function (tab){
    cb(tab);
  })
};


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse){

  var from = sender.tab ? 'CONTENT_SCRIPT' : 'EXTENSION';
  var narrowedResponse = INBOX[from][request.message];

  if (narrowedResponse) {
    narrowedResponse(request, sender, sendResponse);
    return true;
  }

  return true;
});








