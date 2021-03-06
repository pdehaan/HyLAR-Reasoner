#!/usr/bin/env node

var express = require('express'),
    app = express(),

    path = require('path'),
    bodyParser = require('body-parser'),
    multer  = require('multer');

var Controller = require('./controller'),
    Utils = require('../core/Utils');

var ontoDir = Controller.configuration.ontoDir,
    port = Controller.configuration.port,
    upload = multer({ dest: ontoDir });

process.on('uncaughtException', function(err) {
    console.error('Uncaught Exception');
    throw err;
});

app.set('view engine', 'ejs');

// parse text/plain
app.use(function(req, res, next){
    if (req.is('text/*')) {
        req.text = '';
        req.setEncoding('utf8');
        req.on('data', function(chunk){ req.text += chunk });
        req.on('end', next);
    } else {
        next();
    }
});

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// CSS & images
app.use('/css', express.static(__dirname + '/css'));
app.use('/img', express.static(__dirname + '/images'));

// parse application/json
app.use(bodyParser.json());
console.notify('Setting up routes...');


// Server utils
app.all('*', Controller.allowCrossDomain);
app.get('/', Controller.hello);
app.get('/time', Controller.time);

// OWL ontology uploading, parsing, getting, classifying
app.get('/ontology', Controller.list);
app.post('/ontology', upload.single('file'), Controller.upload);
app.get('/ontology/:filename', Controller.getOntology, Controller.sendOntology);

app.get('/classify/:filename', Controller.getOntology, Controller.loadOntology, Controller.sendHylarContents);
app.post('/classify', Controller.escapeStrOntology, Controller.loadOntology, Controller.acknowledgeEnd);

// Rule adding, listing
app.put('/rule', Controller.addRules, Controller.acknowledgeEnd);
app.get('/rule', Controller.listRules);

// SPARQL query processing
app.get('/query', Controller.processSPARQL);

// SPARQL endpoint interface
app.get('/sparql', Controller.sparqlInterface);
app.post('/sparql', Controller.simpleSparql, Controller.sparqlInterface);

// KB explorer interface
app.get('/explore', Controller.renderFact);
app.get('/explore/:uri', Controller.renderFact);

console.notify('Done.');
console.notify('Exposing server to port ' + port + '...');

// Launching server
app.listen(port);
console.notify('Done.');
console.notify('HyLAR is running.');


