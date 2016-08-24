var background = chrome.runtime;
var automation;
var stopped = false;

/**********
 *
 * UTILITIES
 *
 ***********/

/**
 * @param  {ListNode[]} list - An array of
 * @param  {Function} finished - Callback function
 * @param  {Function} decorate - parses a stored (recorded) event into a playable event ie. onSubmit -> button[type=submit].click
 * @param  {number} time - time between sequence executions
 * @return {Function}
 */
const sequenceDelay = function(list, decorate, finished, time){
  let paths = !decorate ? Array.from(list) : Array.from(list).map(item =>{
    return decorate(item);
  });

  return function event(){
    let finish = function(){
      paths.shift();
      if (paths.length) {
        event();
      }
    };
    setTimeout(finished.bind(null, paths[0], finish), time || 600);
  }
};

const uniqueIdentitier = function(base, current, build, levels){
  current = current || base;
  levels = levels || 0;
  build = build || '';

  var nodename = current.nodeName.toLowerCase();
  var thisSelector = '';

  if (levels === 10 || current.nodeName === 'BODY') {
    return build;
  }

  if(levels === 0 && current.nodeName === 'IMG') {
    return 'img[src=\"'+ current.src + '\"]';
  }

  if (current.id) {
    var prefixed = [nodename, '#', current.id].join('');
    return prefixed;
  }

  if (current.className) {
    var prefixed = nodename + '.';
    thisSelector = prefixed += Array.from(current.classList).join('.');

  } else {
    thisSelector = nodename
  }

  if (current.parentElement) {
    return uniqueIdentitier(base, current.parentElement, [thisSelector, build].join(' '), levels + 1)
  }
  return build;

};

// TODO: merge this and findSubmit
var getFromSelector = function(identity){
  if (identity.element === 'A' && identity.href) {
    return Array.from(document.links).filter(function(el){
      return el.href === identity.href;
    })[0];
  } else {
    if(identity.element === 'IMG') {
      debugger
    }
    return document.querySelector(identity.selector);
  }
};

var findSubmit = function(formEl){
  try {
    return formEl.querySelectorAll('input[type=submit], button[type=submit]')[0];
  } catch (e) {
    return formEl;
  }
};

const parseEvent = function(evt){
  console.log('PARSING', evt);

  let directions = evt.val;
  let node = getFromSelector(directions);
  if (!node) {
    throw new Error({message: 'Couldn\'t find node from selector'});
  }

  if (directions.type === 'input') {
    return function(){
      node.value = directions.value;
    };
  }
  else if (directions.type === 'submit') {
    return function(submitType){
      let syntheticEvent = new Event('click');
      submitType.dispatchEvent(syntheticEvent);
    }.bind(null, findSubmit(node));
  }
  else if (directions.type === 'click') {
    return function(){
      let syntheticEvent = new Event(directions.type, {
        bubbles: true
      });
      // node.focus();
      node.dispatchEvent(syntheticEvent);
    };
  }
};

/************
 *
 * LINKED LIST
 *
 *************/

const LinkedList = function(){
  this.head = null;
  this.tail = null;
  this.pageFragments = {};
  this.size = 0;
  this._asArray = [];
};

const ListNode = function(val){
  this.val = val;
  this.next = null;
};

LinkedList.prototype.addToTail = function(val){
  var node = new ListNode(val);
  if (!this.head) {
    this.head = node;
  } else {
    this.tail.next = node;
  }
  this._asArray.push(node);
  this.size++;
  this.tail = node;
};

LinkedList.prototype.atIndex = function(index){
  let node = this.head, count = 0;
  if (index > this.size) {
    return;
  }

  while (node && index > count) {
    node = node.next;
    count++;
  }
  return node;
};

/*********
 * RECORDER
 **********/

const RecordFragment = function(){
  this.cache = new LinkedList();
  this.initEventListeners();

  window.addEventListener('beforeunload', function(evt){
    console.log('BEFORE UNLOAD!');
    console.dir(automation);
    Object.keys(automation).forEach(key => {
      console.log('key ', key, ' value ', automation[key]);
    });
    // return false;
    if (stopped) {
      return;
    }
    background.sendMessage({message: 'UNLOAD', details: automation, location: window.location}, function(resp){
    });
  });
};

/**
 * @method _onInput
 * @param evt
 */
RecordFragment.prototype._onInput = function(evt){
  let unique = uniqueIdentitier(evt.target);

  this.cache.addToTail({
    effect: 'mutation',
    element: evt.target,
    selector: uniqueIdentitier(evt.target),
    type: 'input',
    value: evt.target.value,
    _event: evt
  });
};

/**
 * @method _onSubmit
 * @param evt - The dom event
 */
RecordFragment.prototype._onSubmit = function(evt){
  let unique = uniqueIdentitier(evt.target);

  this.cache.addToTail({
    effect: 'action',
    element: evt.target,
    selector: uniqueIdentitier(evt.target),
    type: 'submit',
    value: null,
    _event: evt
  });
};

/**
 * @method _onClick
 * @param evt - The dom event
 */
RecordFragment.prototype._onClick = function(evt){
  let unique = uniqueIdentitier(evt.target);

  this.cache.addToTail({
    effect: 'action',
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
RecordFragment.prototype.initEventListeners = function(){
  // inputs
  Array.from(document.getElementsByTagName('input')).forEach(function(el){
    el.addEventListener('input', this._onInput.bind(this));
  }, this);

  // forms
  Array.from(document.forms).forEach(function(el){
    el.addEventListener('submit', this._onSubmit.bind(this));
  }, this);

  // links
  Array.from(document.links).forEach(function(el){
    el.addEventListener('click', function(evt){
      console.log('LINK CLICK', evt);

      this._onClick.call(this, evt);
    }.bind(this), true);

  }, this);

  // images
  Array.from(document.images).forEach(el => {
    el.addEventListener('click', function(evt){
      console.log('IMAGE CLICK');
      this._onClick.call(this, evt);
    }, true);
  });

  // document.click
  document.addEventListener('click', function(evt){
    const nodename = evt.target.nodeName;
    const pass = {
      'IMG':null
    };

    if(nodename in pass) {
      console.log('DOCUMENT CLICK: evt.target =', evt, ' capture');
      this._onClick.call(this, evt);
    }
  }.bind(this), true);

};

/*********
 * PLAYBACK
 **********/
/**
 * @param  {Object} instructions - The instructions used to playback the automation.
 * @param  {number} wait  - amount of time to pause between events
 * @return {none}
 */
const playback = function(instructions, wait){
  var events = {
    mutation: function(inst, ele, cb){
      ele.value = inst.value;
      cb();

    },
    action: function(inst, ele, cb){
      let syntheticEvent = new Event(inst.type);
      if (inst.type === 'submit') {
        ele.submit();
      } else {
        ele.dispatchEvent(syntheticEvent);
      }
      cb();
    }
  };

  sequenceDelay(instructions, parseEvent, function(event, callback){
    event();
    callback();
  })();
};

/**********
 * MESSAGING
 ***********/


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  if (request.message === "RECORD") {
    if (!automation) {
      automation = new RecordFragment();
      sendResponse({
        message: "ACCEPT",
        location: window.location.href
      });
    } else {
      sendResponse({
        message: "IN_PROGRESS"
      });
    }
  }

  if (request.message === "PLAYBACK") {
    playback(request.details);
    sendResponse({message: 'RUNNING'});
  }

  if (request.message === 'STOP') {
    stopped = true;
    if (automation) {
      console.info('sending last fragment', automation);
      sendResponse({
        details: automation.cache.size ? automation : null,
        location: window.location.href
      });
      automation = null;
    } else {
      sendResponse({
        message: null
      })
    }
  }
});

window.addEventListener('DOMContentLoaded', function(evt){
  background.sendMessage({message: 'STATE_REQUEST'}, function(response){
    console.log('automate:: state request response ', response);
    if (response.value === 'RECORDING') {
      setTimeout(function(){
        automation = new RecordFragment();
      },1000);

    } else if (response.value === 'PLAYING') {
      playback(response.details)
    } else {

    }
  });

});


