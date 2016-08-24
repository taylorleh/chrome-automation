var responseQ = [];
var recording = false;
var playing = false;

var LLDecorator = {
  attachToTail: function(frag){
    this._asArray = this._asArray.concat(frag._asArray);
    this.size += frag.size;

    // traversal
    let front = this.head;
    while (front.next) {
      front = front.next
    }

    front.next = frag.head;
    this.tail = frag.tail;
  },

  saveFragment: function(frag){
    const count = Object.keys(this.pageFragments).length + 1;
    this.pageFragments[count] = frag._asArray;
  }
};

var RecordingsModule = (function(){
  let pages = {};              // hash of urls and LL recordings
  let currentRecording = null; // linked List of current (in progress) recording
  let initialPage = null; // url of starting page of recording so can append after
  let ongoingFragIndex = 0; // for multi page automations - keeps track of which LL fragment to send on page load
  let currentPlayback = null; // set after ui starts playback on first page.

  return {
    append: function(fragment){
      if (currentRecording) { // append to current automation fragment
        LLDecorator.saveFragment.call(currentRecording, fragment.cache);
        LLDecorator.attachToTail.call(currentRecording, fragment.cache);
      } else if (initialPage && !currentRecording) { // first fragment to add to LL recording
        currentRecording = fragment.cache;
        LLDecorator.saveFragment.call(currentRecording, fragment.cache);
      } else { // no initial page set and current fragments
      }
    },

    begin: function(url){
      if (!initialPage && !currentRecording) {
        initialPage = url;
      } else {
      }
    },

    showBuilt: function(){
    },

    build: function(){
      currentRecording.totalFragments = Object.keys(currentRecording.pageFragments).length;
      pages[initialPage] = currentRecording;
      currentRecording = null;
      initialPage = null;
    },

    getOngoingFragment: function(url){
      let returnFrag;
      let firstFrag;
      let pageAutomations;

      if (url && !playing) { // initial playback, return first fragment
        ongoingFragIndex = 0;
        playing = true;
        if (pageAutomations = pages[url]) {
          currentPlayback = pageAutomations;
          firstFrag = pageAutomations.pageFragments[ongoingFragIndex += 1];
          return firstFrag;
        }
      } else if (currentPlayback) {
        if (ongoingFragIndex > currentPlayback.totalFragments) {
          playing = false;
          currentPlayback = null;
          return currentPlayback;
        }

        returnFrag = currentPlayback.pageFragments[ongoingFragIndex += 1];
        return returnFrag;
      }
    },

    getCurrentFragIndex: function(){
      return ongoingFragIndex;
    },

    currentPlaylist: function(){
      return currentPlayback || null;
    },

    debug: function(){
      return {pages: pages, currentPlayback: currentPlayback, currentRecording: currentRecording};
    },

    _internal: 0

  };
}());

const INBOX = {
  EXTENSION: { // messages received from the extension (popup.js) invoked by user interaction
    STATE_REQUEST: function(request, sender, sendResponse){
      if (recording && !playing) {
        sendResponse({value: 'ACCEPT'});
      } else if (playing && !recording) {
        console.log('background:: nothing to send popup for - playing, !recording');
      } else if (!recording && !playing) {
        sendResponse({value: 'DEFAULT'})
      } else {
      }
    },

    STOP: function(request, sender, sendResponse){
      messageContentScript({message: 'STOP'}, function(csresp){
        recording = false;
        playing = false;
        if (csresp.details) { // check if there were any actions on the page where 'stop' was clicked
          RecordingsModule.append(csresp.details);
        }
        RecordingsModule.showBuilt();
        RecordingsModule.build();
        sendResponse({
          value: 'DEFAULT'
        })

      });
    },

    PLAYBACK: function(request, sender, sendResponse){
      if (playing || recording) {
        sendResponse({
          value: 'IN_PROGRESS'
        });
        return;
      } else {
        sendResponse({
          value: 'RUNNING'
        });
      }

      getPageUrl(function(tab){
        let frag = RecordingsModule.getOngoingFragment(tab.url);
        if (!frag) {
        }
        messageContentScript({
          message: 'PLAYBACK',
          details: frag
        });
      })
    },

    /**
     * @return {boolean}
     */
    RECORD: function(request, sender, sendResponse){
      recording = true;
      messageContentScript({message: 'RECORD'}, function(response){
        if (response.message === 'ACCEPT') { // if content script accepts
          RecordingsModule.begin(response.location);
          sendResponse({
            value: 'ACCEPT'
          });

        } else { // else if content script denies
          sendResponse({
            value: 'IN_PROGRESS'
          });
        }

      });
      return true;

    }
  },
  CONTENT_SCRIPT: {
    STATE_REQUEST: function(request, sender, sendResponse){

      let frag;
      let index;
      let playlist;
      let state = 'DEFAULT';
      if (recording && !playing) {
        state = 'RECORDING';
      } else if (playing && !recording) {
        state = 'PLAYING';
        playlist = RecordingsModule.currentPlaylist();
        index = RecordingsModule.getCurrentFragIndex();
        if (index < playlist.totalFragments) {
          frag = RecordingsModule.getOngoingFragment();
        } else if (index === playlist.totalFragments) {
          state = 'DEFAULT';
          playing = false;
        }
        if (!frag) {
        }
      }

      sendResponse({
        value: state,
        details: frag || null
      });
    },

    UNLOAD: function(request){
      // pages[request.location.href] = request.details;
      console.log('received unload', request);
      RecordingsModule.append(request.details);
    }
  }
};

const messageContentScript = function(msg, cb){

  chrome.tabs.query({active: true}, function(tabs){
    chrome.tabs.sendMessage(tabs[0].id, msg, function(response){
      if (cb) {
        cb(response)
      }
    });
  });
};

/**
 * @function getPageUrl
 * @description to send message to content script, we must first query the tab
 * @param cb
 */
const getPageUrl = function(cb){
  chrome.tabs.getSelected(function(tab){
    cb(tab);
  })
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){

  const from = sender.tab ? 'CONTENT_SCRIPT' : 'EXTENSION';
  let narrowedResponse = INBOX[from][request.message];

  if (narrowedResponse) {
    narrowedResponse(request, sender, sendResponse);
    return true;
  }

  return true;
});








