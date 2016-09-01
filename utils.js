/**
 * Created by taylor on 8/25/16.
 */

const styles = {
  "gray": "font-size: 12px; color: #1B2B34;",
  "error": "font-size: 12px; color: #EC5f67;",
  "warn": "font-size: 12px; color: #F99157;",
  "yellow": "font-size: 12px; color: #FAC863;",
  "green": "font-size: 12px; color: #99C794;",
  "log": "font-size: 12px; color: #5FB3B3;",
  "info": "font-size: 12px; color: #6699CC;",
  "purple": "font-size: 12px; color: purple;",
  "dir": "font-size: 12px; color: purple;",
  "base": "font-size: 12px; color: #AB7967; font-family: monospace; font-weight:bold;",
  'time': "font-size: 10px; color: white; background-color: grey;"
};

(function(ctx){
  const methods = ['log', 'dir', 'warn', 'error'];

  let _console = ctx.console;
  let logger = {};

  const argType = function(arg){
    return Object.prototype.toString.call(arg);
  };

  const tupleArgs = function(args, method, label){
    return args.reduce((memo, arg) =>{
      let type = argType(arg);

      if (type === '[object Object]' || type === '[object Array]') {
        memo[0] = memo[0].concat(' %O');
        memo[1].push(arg);
      } else {
        memo[0] = memo[0].concat(arg);
      }

      return memo;
    }, [label, [styles.base, styles.time, styles[method], '']])
  };

  const bindLogMethod = function(type){
    return function(){
      let label = `%cautomate::%c${new Date().toLocaleTimeString()}%c [${type.toUpperCase()}] - %c`;
      let args = Array.from(arguments);
      let out = args.length ? tupleArgs(args, type, label) : [];

      _console.log.apply(_console, [].concat(out[0]).concat(out[1]));
    }
  };

  methods.forEach(type =>{
    logger[type] = bindLogMethod(type);
  });

  ctx.console = logger;
}(window));
