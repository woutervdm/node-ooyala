var merge = require('merge');
var querystring = require('querystring');
var request = require('request');
var crypto = require('crypto');

module.exports = function(options)
{
	options = merge({}, {
		api_key: '',
		secret: '',
		expirationTime: 30,
		api: 'api'
	}, options);

	var getSignature = function(method, path, params, body)
	{
		var str = options.secret + method + path;

		Object.keys(params).sort().forEach(function(key)
		{
			str += key +'=' + params[key];
		});

		var hash = crypto.createHash('sha256');
		hash.update(str);
		if (body)
		{
			hash.update(body);
		}

		return hash.digest('base64').substr(0,43).replace(/=+$/, '');
	};

	var doRequest = function(method, path, params, body, callback)
	{
		var usedParams = merge({}, {
			api_key: options.api_key,
			expires: Math.floor((new Date()).getTime()/1000) + options.expirationTime
		}, params);

		var url = 'https://' + options.api + '.ooyala.com' + path + '?' + querystring.stringify(merge(usedParams, {
				signature: getSignature(method, path, usedParams, body)
			}));

		request({
				url: url,
				method: method,
				body: body,
				headers: {
					'Content-Type': 'application/json'
				}
			},
			function(err, response, _body)
			{
				if (err)
				{
					callback(err);
					return;
				}

				var body;

				try
				{
					body = JSON.parse(_body);
				}
				catch(e)
				{
					body = null;
				}

				if (response.statusCode >= 200 && response.statusCode < 300 && body)
				{
					callback(null, body);
				}
				else if (body === null)
				{
					callback('Unable to parse JSON: ' + _body);
				}
				else
				{
					callback('Invalid API status code: ' + response.statusCode + ', ' + _body);
				}
			});
	};

	var result = {
		getSignature: getSignature
	};

	['get', 'post', 'delete', 'put', 'patch'].forEach(function(method)
	{
		result[method] = function(path, body, params, callback)
		{
			doRequest.apply(null, [method.toUpperCase()].concat([
				path,
				typeof params == 'function' ? {} : params,
				typeof body == 'function'  || !body ? '' : (typeof body != 'string' && !(body instanceof Buffer) ? JSON.stringify(body) : body),
				[].slice.apply(arguments, [-1])[0]
			]));
		};
	});

	return result;
};