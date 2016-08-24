const UI = function (){
  var ctx = null;
  return {
    get: function (id){
      ctx = document.getElementById(id);
      return this;
    },
    clear: function (){
      if (ctx) {
        ctx.innerHTML = '';
        return this;
      }
    },
    append: function (str){
      ctx.innerHTML = str;
      return this;
    }
  }
}();


const UI_FLOWS = {
  RECORD: function (msg){
    UI.get('status').clear().append(msg.value);
  }
};


const sendExtensionMessage = function (msg, cb){
  chrome.runtime.sendMessage(msg, function (response){
    if (cb) {
      cb(response);
    }
  });
};


document.addEventListener('DOMContentLoaded', function (){
  document.getElementById('record').addEventListener('click', function (){
    sendExtensionMessage({message: 'RECORD'}, function (response){
      UI.get('status').clear().append(response.value);
    })
  });

  document.getElementById('playback').addEventListener('click', function (){
    sendExtensionMessage({message: 'PLAYBACK'}, function (response){
      UI.get('status').clear().append(response.value);
    });
  });

  document.getElementById('stop').addEventListener('click', function (){
    sendExtensionMessage({message: 'STOP'}, function (response){
      UI.get('status').clear().append(response.value);
    });
  });

  sendExtensionMessage({message: 'STATE_REQUEST'}, function (response){
    UI.get('status').clear().append(response.value);
  })

});






