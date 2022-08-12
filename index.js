const restify = require('restify');
const restifyclient = require('restify-clients');
const joi = require('joi');
const _ = require('lodash')
const reqclient = restifyclient
  .createJsonClient({
    url: 'https://assessments.reliscore.com',
    agent: false
  });


const billing = (params) => {
  return new Promise((resolve, reject) => {
    const BILLING_API = '/api/billing/' + params.deptid;
    reqclient.get(BILLING_API, (error, request, response, body) => {
      if (body.status !== 'error' && response.statusCode === 200) {
        return resolve(body.data);
      } else {
        return reject(body);
      }
    });
  });
};


const customer = (params) => {
  return new Promise((resolve, reject) => {
    reqclient.get('/api/customers/', (error, request, response, body) => {
      if (body.status !== 'error' && response.statusCode === 200) {
        return resolve(body.data);
      } else {
        return reject({});
      }
    });
  });
};

function respond(req, res, next) {
  const schema = joi.object().keys({
    deptid: joi.number().integer().min(111).max(999).required(),
    amount: joi.number().integer().required(),
    plantype: joi.string().required()
  }).options({
    stripUnknown: true
  });

  const errresp = {
    'status': '',
  }
  joi.validate(req.query, schema, (err, params) => {
    if (err) {
      errresp.status = 'error';
      errresp.message = err.details;
      res.send(errresp);
      return next();
    }
    const promise = [];
    promise.push(billing(params));
    promise.push(customer(params));
    let exceptions = [];
    let missing = [];
    return Promise.all(promise).then((resp) => {
      if (!_.isEmpty(resp)) {
        const billingdata = resp[0];
        const customerdata = resp[1];
        _.each(customerdata, (value, key) => {
            if (value === params.plantype) {
                _.each(billingdata, (v, k) => {
                    if (k === key) {
                        if (v > params.amount) {
                            exceptions.push(k);
                        }
                    }
                })
            }
        });
        missing = Object.keys(billingdata).filter(x => Object.keys(customerdata).indexOf(x) === -1);
      }
      errresp.status = 'success';
      errresp.data = {
        exceptions : exceptions,
        missing : missing
      }
    res.json(errresp);
    return next();
    }).catch((error) => {
      errresp.status = 'error';
      errresp.message = error;
      res.json(errresp)
      return next();
    });
  });
}

const server = restify.createServer();
server.use(restify.plugins.queryParser({
  mapParams: true,
  arrayLimit: 20,
}));

server.get({
  name: 'billing',
  path: '/api/exceptions'
}, respond);

server.listen(8080, function () {
  console.log('%s listening at %s', 'billing-app', 'localhost:8080');
});