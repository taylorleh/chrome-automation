const { fromNode, toNode } = require('simple-xpath-position');

const background = chrome.runtime;
let automation;

/**
 * @param  {ListNode[]} list - An array of
 * @param  {Function} finished - Callback function
 * @param  {Function} decorate - parses a stored (recorded) event into a playable event ie. onSubmit -> button[type=submit].click
 * @param  {number} time - time between sequence executions
 * @return {Function}
 */
const sequenceDelay = function(list, decorate, finished, time) {
  const paths = !decorate ? Array.from(list) : Array.from(list).map(item => decorate(item));

  return function event() {
    const finish = function() {
      paths.shift();
      if (paths.length) {
        event();
      }
    };
    setTimeout(finished.bind(null, paths[0], finish), time || 600);
  };
};

const uniqueIdentitier = function(base, current = base, build = '', levels = 0) {
  const nodeName = current.nodeName.toLowerCase();
  let thisSelector = '';
  let prefixed;

  if (levels === 10 || current.nodeName === 'BODY') {
    return build;
  }

  if (levels === 0 && current.nodeName === 'IMG') {
    return `img[src="${current.src}"]`;
  }

  if (current.id) {
    prefixed = [nodeName, '#', current.id].join('');
    return prefixed;
  }

  if (current.className) {
    prefixed = `${nodeName}.`;
    thisSelector = prefixed + Array.from(current.classList).join('.');
  } else {
    thisSelector = nodeName;
  }

  if (current.parentElement) {
    return uniqueIdentitier(base, current.parentElement, [thisSelector, build].join(' '), levels + 1);
  }
  return build;
};

const findSubmit = function(formEl) {
  const submitableElements = [formEl];
  try {
    submitableElements.push(
      formEl.querySelectorAll('input[type=submit], button[type=submit]')[0]
    );
  } catch (e) {
    console.warn('Could not find secondary submit type from form el =', formEl);
  }
  return submitableElements;
};

const parseEvent = function(evt) {
  const directions = evt.val;
  const node = toNode(directions.xpath, window.document);
  if (!node) {
    throw new Error({ message: 'Couldn\'t find node from selector' });
  }

  if (directions.type === 'input') {
    return function() {
      node.value = directions.value;
    };
  } else if (directions.type === 'submit') {
    return function(submitEls) {
      console.info('submitable elements', submitEls);
      try {
        submitEls[0].submit();
      } catch (e) {
        console.warn('could not invoke "submit" on', submitEls[0]);
        const syntheticEvent = new Event('click');
        submitEls[1].dispatchEvent(syntheticEvent);
      }
    }.bind(null, findSubmit(node));
  } else if (directions.type === 'click') {
    return function() {
      const syntheticEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      console.info('parsing click event', syntheticEvent);
      node.dispatchEvent(syntheticEvent);
    };
  }
  return null;
};

/**
 *************
 * LINKED LIST
 *************
 */

const LinkedList = function() {
  this.head = null;
  this.tail = null;
  this.pageFragments = {};
  this.size = 0;
  this._asArray = [];
};

const ListNode = function(val) {
  this.val = val;
  this.next = null;
};

LinkedList.prototype.addToTail = function(val) {
  const node = new ListNode(val);
  if (!this.head) {
    this.head = node;
  } else {
    this.tail.next = node;
  }
  this._asArray.push(node);
  this.size++;
  this.tail = node;
};

LinkedList.prototype.atIndex = function(index) {
  let node = this.head;
  let count = 0;
  if (index > this.size) {
    return null;
  }

  while (node && index > count) {
    node = node.next;
    count++;
  }
  return node;
};

/**
 * ********
 * RECORDER
 * ********
 */

const RecordFragment = function() {
  this.cache = new LinkedList();
  this.boundInput = this.onInput.bind(this);
  this.boundSubmit = this.onSubmit.bind(this);
  this.boundClikc = this.onClick.bind(this);
  this.listeners = {
    images: Array.from(document.images),
    links: Array.from(document.links),
    forms: Array.from(document.forms),
    inputs: Array.from(document.getElementsByTagName('input'))
  };
  this.initEventListeners();

  window.addEventListener('beforeunload', () => {
    console.log('BEFORE UNLOAD!');
    if (automation && automation.cache) {
      background.sendMessage({ message: 'UNLOAD', details: automation, location: window.location });
    } else {
      console.log('no actions performed on this page');
    }
  });
};

/**
 * @method onInput
 * @param evt
 */
RecordFragment.prototype.onInput = function(evt) {
  console.info('xpath selector ', fromNode(evt.target));
  this.cache.addToTail({
    effect: 'mutation',
    xpath: fromNode(evt.target),
    element: evt.target,
    selector: uniqueIdentitier(evt.target),
    type: 'input',
    value: evt.target.value,
    _event: evt
  });
};

/**
 * @method onSubmit
 * @param evt - The dom event
 */
RecordFragment.prototype.onSubmit = function(evt) {
  console.info('xpath selector ', fromNode(evt.target));
  this.cache.addToTail({
    effect: 'action',
    xpath: fromNode(evt.target),
    element: evt.target,
    selector: uniqueIdentitier(evt.target),
    type: 'submit',
    value: null,
    _event: evt
  });
};

/**
 * @method onClick
 * @param evt - The dom event
 */
RecordFragment.prototype.onClick = function(evt) {
  console.info('xpath selector ', fromNode(evt.target));
  this.cache.addToTail({
    effect: 'action',
    xpath: fromNode(evt.target),
    element: evt.target.nodeName,
    href: evt.target.href,
    selector: uniqueIdentitier(evt.target),
    type: 'click',
    value: null,
    _event: evt
  });
};

/**
 * @method initEventListeners
 * @description Bind event listeners to dom objects
 */
RecordFragment.prototype.initEventListeners = function() {
  const { inputs, links, forms, images } = this.listeners;
  // inputs
  inputs.forEach(el => el.addEventListener('input', this.boundInput));

  // forms
  forms.forEach(el => el.addEventListener('submit', this.boundSubmit));

  // links
  links.forEach(el => el.addEventListener('click', this.boundClikc));

  // images
  images.forEach(el => el.addEventListener('click', this.boundClikc));
};

RecordFragment.prototype.removeEvents = function() {
  const { inputs, links, forms, images } = this.listeners;
  // inputs
  inputs.forEach(el => el.removeEventListener('input', this.boundInput));

  // forms
  forms.forEach(el => el.removeEventListener('submit', this.boundSubmit));

  // links
  links.forEach(el => el.removeEventListener('click', this.boundClikc));

  // images
  images.forEach(el => el.removeEventListener('click', this.boundClikc));
};
/**
 * ********
 * PLAYBACK
 * ********
 */

/**
 * @param  {Object} instructions - The instructions used to playback the automation.
 * @return {none}
 */
const playback = function(instructions) {
  sequenceDelay(instructions, parseEvent, (event, callback) => {
    event();
    callback();
  })();
};

/**
 * *********
 * MESSAGING
 * *********
 */


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'RECORD') {
    if (!automation) {
      automation = new RecordFragment();
      sendResponse({
        message: 'ACCEPT',
        location: window.location.href
      });
    } else {
      sendResponse({
        message: 'IN_PROGRESS'
      });
    }
  }

  if (request.message === 'PLAYBACK') {
    playback(request.details);
    sendResponse({ message: 'RUNNING' });
  }

  if (request.message === 'STOP') {
    if (automation) {
      console.info('sending last fragment', automation);
      sendResponse({
        details: automation.cache.size ? automation : undefined,
        location: window.location.href
      });
      automation.removeEvents();
      automation = null;
    } else {
      sendResponse({
        message: null
      });
    }
  }
});

const requestState = function() {
  console.log('requesting state');
  background.sendMessage({ message: 'STATE_REQUEST' }, response => {
    console.log('received states response', response);
    if (response.value === 'RECORDING') {
      console.info('continue recording');
      setTimeout(() => {
        automation = new RecordFragment();
      }, 1000);
    } else if (response.value === 'PLAYING') {
      console.info('continue playing');
      if (response.details) {
        playback(response.details);
      } else {
        console.error('state request returned no instructions');
      }
    }
  });
};

window.addEventListener('load', () => {
  console.info('dom loaded');
  setTimeout(() => {
    requestState();
  }, 0);
});
