const MESSAGE_FLOWS = {
  RECORD: {
    ACCEPT: 'Recording Started!',
    IN_PROGRESS: 'Recording already in progress. Please start a new recording',
    DEFAULT: 'Click record to start a new recording'
  },
  PLAYBACK: {
    RUNNING: 'Playback Started',
    IN_PROGRESS: 'Playback already in progress'
  }
};

const UI = (function() {
  let ctx;
  return {
    get(id) {
      ctx = document.getElementById(id);
      return this;
    },
    clear() {
      if (ctx) {
        ctx.innerHTML = '';
      }
      return this;
    },
    append(str) {
      ctx.innerHTML = str;
      return this;
    }
  };
}());

const sendExtensionMessage = (msg, cb) => {
  chrome.runtime.sendMessage(msg, response => {
    if (cb) {
      cb(response);
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('record').addEventListener('click', () => {
    const narrowedResponse = MESSAGE_FLOWS.RECORD;
    sendExtensionMessage({ message: 'RECORD' }, response => {
      if (response.value in narrowedResponse) {
        UI.get('status').clear().append(narrowedResponse[response.value]);
      } else {
        throw new Error({ message: `Cannot find adequate response for ${response.value}` });
      }
    });
  });

  document.getElementById('playback').addEventListener('click', () => {
    const narrowedResponse = MESSAGE_FLOWS.PLAYBACK;
    sendExtensionMessage({ message: 'PLAYBACK' }, response => {
      if (response.value in narrowedResponse) {
        UI.get('status').clear().append(narrowedResponse[response.value]);
      } else {
        throw new Error({ message: `Cannot find adequate response for ${response.value}` });
      }
    });
  });

  document.getElementById('stop').addEventListener('click', () => {
    const narrowedResponse = MESSAGE_FLOWS.RECORD;
    sendExtensionMessage({ message: 'STOP' }, response => {
      if (response.value in narrowedResponse) {
        UI.get('status').clear().append(narrowedResponse[response.value]);
      } else {
        throw new Error({ message: `Cannot find adequate response for ${response.value}` });
      }
    });
  });

  sendExtensionMessage({ message: 'STATE_REQUEST' }, response => {
    const narrowedResponse = MESSAGE_FLOWS.RECORD;
    if (response.value in narrowedResponse) {
      UI.get('status').clear().append(narrowedResponse[response.value]);
    } else {
      throw new Error({ message: `Cannot find adequate response for ${response.value}` });
    }
  });
});
