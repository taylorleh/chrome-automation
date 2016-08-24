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
  let directions = evt.val;
  let node = getFromSelector(directions);
  if (!node) {
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
      node.focus();
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
    if (stopped) {
      return;
    }
    background.sendMessage({message: 'UNLOAD', details: automation, location: window.location}, function(resp){
    });
  });
};

RecordFragment.prototype.initEventListeners = function(){

  Array.from(document.getElementsByTagName('input')).forEach(function(el){
    el.addEventListener('input', function(evt){
      let unique = uniqueIdentitier(evt.target);

      this.cache.addToTail({
        effect: 'mutation',
        element: evt.target,
        selector: uniqueIdentitier(evt.target),
        type: 'input',
        value: evt.target.value,
        _event: evt
      });

    }.bind(this));
  }, this);


  Array.from(document.forms).forEach(function(el){
    el.addEventListener('submit', function(evt){
      let unique = uniqueIdentitier(evt.target);

      this.cache.addToTail({
        effect: 'action',
        element: evt.target,
        selector: uniqueIdentitier(evt.target),
        type: 'submit',
        value: null,
        _event: evt
      });

    }.bind(this));
  }, this);
  Array.from(document.links).forEach(function(el){
    el.addEventListener('click', function(evt){
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

    }.bind(this));
  }, this);
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
    if (response.value === 'RECORDING') {
      automation = new RecordFragment();
    } else if (response.value === 'PLAYING') {
      playback(response.details)
    } else {

    }
  });

});










