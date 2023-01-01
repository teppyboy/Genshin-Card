const md5 = require('md5')

const randomStr = (length) => {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

const randomInt = (min, max) => {
  // [min, max)
  return Math.floor(Math.random() * (max - min)) + min;
}

const getQueryParam = (data) => {
	if ( data === undefined ) {
		return "";
	}
	const arr = [];
	for ( let key of Object.keys(data) ) {
		arr.push( `${key}=${data[key]}` );
	}
	return arr.join("&");
}

const getDS = (query, body="") => {
  // v2.11.1 - from app
  const n = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs";
  const i = Date.now() / 1000 | 0;
  const r = randomInt(100001, 200000);
  const q = getQueryParam(query);
  const c = md5(`salt=${n}&t=${i}&r=${r}&b=${body}&q=${q}`);

  return `${i},${r},${c}`;
}

const render = (template, context) => {

    var tokenReg = /(\\)?\{\{([^\{\}\\]+)(\\)?\}\}/g;

    return template.replace(tokenReg, function (word, slash1, token, slash2) {
        if (slash1 || slash2) {  
            return word.replace('\\', '');
        }

        var variables = token.replace(/\s/g, '').split('.');
        var currentObject = context;
        var i, length, variable;

        for (i = 0, length = variables.length; i < length; ++i) {
            variable = variables[i];
            currentObject = currentObject[variable];
            if (currentObject === undefined || currentObject === null) return '';
        }
        return currentObject;
    });
}

module.exports = {
  randomStr,
  render,
  getDS
}