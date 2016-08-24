const MESSAGE_FLOWS = {
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

const UI = function(){
  var ctx = null;
  return {
    get: function(id){
      ctx = document.getElementById(id);
      return this;
    },
    clear: function(){
      if (ctx) {
        ctx.innerHTML = '';
        return this;
      }
    },
    append: function(str){
      ctx.innerHTML = str;
      return this;
    }
  }
}();

const UI_FLOWS = {
  RECORD: function(msg){
    UI.get('status').clear().append(msg.value);
  }
};

const sendExtensionMessage = function(msg, cb){
  chrome.runtime.sendMessage(msg, function(response){
    if (cb) {
      cb(response);
    }
  });
};

document.addEventListener('DOMContentLoaded', function(){

  document.getElementById('record').addEventListener('click', function(){
    let narrowedResponse = MESSAGE_FLOWS.RECORD;
    sendExtensionMessage({message: 'RECORD'}, function(response){
      if (response.value in narrowedResponse) {
        UI.get('status').clear().append(narrowedResponse[response.value]);
      } else {
        throw new Error({message: 'Cannot find adequate response for ' + response.value});
      }
    });
  });

  document.getElementById('playback').addEventListener('click', function(){
    let narrowedResponse = MESSAGE_FLOWS.PLAYBACK;
    sendExtensionMessage({message: 'PLAYBACK'}, function(response){
      if (response.value in narrowedResponse) {
        UI.get('status').clear().append(narrowedResponse[response.value]);
      } else {
        throw new Error({message: 'Cannot find adequate response for ' + response.value});
      }
    });
  });

  document.getElementById('stop').addEventListener('click', function(){
    let narrowedResponse = MESSAGE_FLOWS.RECORD;
    sendExtensionMessage({message: 'STOP'}, function(response){
      if (response.value in narrowedResponse) {
        UI.get('status').clear().append(narrowedResponse[response.value]);
      } else {
        throw new Error({message: 'Cannot find adequate response for ' + response.value});
      }
    });
  });

  sendExtensionMessage({message: 'STATE_REQUEST'}, function(response){
    let narrowedResponse = MESSAGE_FLOWS.RECORD;
    if (response.value in narrowedResponse) {
      UI.get('status').clear().append(narrowedResponse[response.value]);
    } else {
      throw new Error({message: 'Cannot find adequate response for' + response.value});
    }
  });

});






