/************************************************************************
 * Copyright (c) Crater Dog Technologies(TM).  All Rights Reserved.     *
 ************************************************************************
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.        *
 *                                                                      *
 * This code is free software; you can redistribute it and/or modify it *
 * under the terms of The MIT License (MIT), as published by the Open   *
 * Source Initiative. (See http://opensource.org/licenses/MIT)          *
 ************************************************************************/
'use strict';

const debug = true;
const repository = require('../s3/S3Repository').repository(debug);
const bali = require('bali-component-framework');
const notary = require('bali-digital-notary').v1Public;


if (debug) console.log('Loading the "PingCertificate" lambda function');
 
exports.handler = async function(request) {

    // validate the security credentials
    try {
        const credentials = bali.parse(request.headers['Nebula-Credentials']);
        await validateCredentials(credentials);
    } catch (exception) {
        return {
            statusCode: 403  // Forbidden
        };
    }

    // extract the request parameters
    var method;
    var type;
    var identifier;
    var document;
    try {
        method = request.httpMethod.toLowerCase();
        const tokens = request.path.split('/');
        type = tokens[0];
        identifier = tokens[1];
        if (request.body) document = bali.parse(request.body);
    } catch (exception) {
        return {
            statusCode: 400  // Bad Request
        };
    }
    
    // execute the request
    var response;
    try {
        response = await executeRequest(method, type, identifier, document);
    } catch (exception) {
        return {
            statusCode: 503  // Service Unavailable
        };
    }
    return response;
};


const validateCredentials = async function(credentials) {
    const citation = credentials.getValue('$component');
    const certificateId = citation.getValue('$tag').getValue() + citation.getValue('$version');
    const certificate = repository.fetchCertificate(certificateId);
    const catalog = bali.catalog.extraction(citation, bali.list([
        '$protocol',
        '$timestamp',
        '$previous',
        '$component',
        '$citation'
    ]));  // everything but the signature
    const publicKey = certificate.getValue('$publicKey');
    const signature = credentials.getValue('$signature');
    const isValid = notary.verify(catalog, publicKey, signature);
    if (!isValid) throw Error();
};


const executeRequest = async function(method, type, identifier, document) {
    switch (type) {
        case 'certificate':
            return await certificateRequest(method, identifier, document);
        case 'type':
            return await typeRequest(method, identifier, document);
        case 'draft':
            return await draftRequest(method, identifier, document);
        case 'document':
            return await documentRequest(method, identifier, document);
        case 'queue':
            return await queueRequest(method, identifier, document);
        default:
            return {
                statusCode: 400  // Bad Request
            };
    }
};


const certificateRequest = async function(method, identifier, document) {
    switch (method) {
        case 'head':
            if (await repository.certificateExists(identifier)) {
                return {
                    statusCode: 200  // OK
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        case 'post':
            if (await repository.certificateExists(identifier)) {
                return {
                    statusCode: 409  // Conflict
                };
            }
            await repository.createCertificate(identifier, document);
            return {
                statusCode: 201  // Created
            };
        case 'get':
            document = await repository.fetchCertificate(identifier);
            if (document) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Length': document.length,
                        'Content-Type': 'application/bali',
                        'Cache-Control': 'immutable'
                    },
                    body: document
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        default:
            return {
                statusCode: 405  // Method Not Allowed
            };
    }
};


const typeRequest = async function(method, identifier, document) {
    switch (method) {
        case 'head':
            if (await repository.typeExists(identifier)) {
                return {
                    statusCode: 200  // OK
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        case 'post':
            if (await repository.typeExists(identifier)) {
                return {
                    statusCode: 409  // Conflict
                };
            }
            await repository.createType(identifier, document);
            return {
                statusCode: 201  // Created
            };
        case 'get':
            document = await repository.fetchType(identifier);
            if (document) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Length': document.length,
                        'Content-Type': 'application/bali',
                        'Cache-Control': 'immutable'
                    },
                    body: document
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        default:
            return {
                statusCode: 405  // Method Not Allowed
            };
    }
};


const draftRequest = async function(method, identifier, document) {
    switch (method) {
        case 'head':
            if (await repository.draftExists(identifier)) {
                return {
                    statusCode: 200  // OK
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        case 'put':
            if (await repository.documentExists(identifier)) {
                return {
                    statusCode: 409  // Conflict
                };
            }
            await repository.saveDraft(identifier, document);
            return {
                statusCode: 201  // Created
            };
        case 'get':
            document = await repository.fetchDraft(identifier);
            if (document) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Length': document.length,
                        'Content-Type': 'application/bali',
                        'Cache-Control': 'no-store'
                    },
                    body: document
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        case 'delete':
            if (await repository.draftExists(identifier)) {
                await repository.deleteDraft(identifier);
                return {
                    statusCode: 200  // OK
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        default:
            return {
                statusCode: 405  // Method Not Allowed
            };
    }
};


const documentRequest = async function(method, identifier, document) {
    switch (method) {
        case 'head':
            if (await repository.documentExists(identifier)) {
                return {
                    statusCode: 200  // OK
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        case 'post':
            if (await repository.documentExists(identifier)) {
                return {
                    statusCode: 409  // Conflict
                };
            }
            await repository.createDocument(identifier, document);
            return {
                statusCode: 201  // Created
            };
        case 'get':
            document = await repository.fetchDocument(identifier);
            if (document) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Length': document.length,
                        'Content-Type': 'application/bali',
                        'Cache-Control': 'immutable'
                    },
                    body: document
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        default:
            return {
                statusCode: 405  // Method Not Allowed
            };
    }
};


const queueRequest = async function(method, identifier, document) {
    switch (method) {
        case 'put':
            await repository.queueMessage(identifier, document);
            return {
                statusCode: 201  // Created
            };
        case 'get':
            document = await repository.dequeueMessage(identifier);
            if (document) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Length': document.length,
                        'Content-Type': 'application/bali',
                        'Cache-Control': 'no-store'
                    },
                    body: document
                };
            }
            return {
                statusCode: 404  // Not Found
            };
        default:
            return {
                statusCode: 405  // Method Not Allowed
            };
    }
};
