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

/*
 * This library provides access to functions that are needed within the
 * Bali Cloud Operating System™. For more information about the Bali Cloud
 * see <https://github.com/craterdog-bali/bali-reference-guide/wiki>.
 */
var BaliDocument = require('bali-document-notation/BaliDocument');
var parser = require('bali-document-notation/transformers/DocumentParser');
var compiler = require('./compiler/ProcedureCompiler');
var assembler = require('./compiler/ProcedureAssembler');
var VirtualMachine = require('./processor/VirtualMachine').VirtualMachine;


// PUBLIC FUNCTIONS

/**
 * This function compiles a Bali Document Notation™ type.
 * 
 * @param {BaliDocument} type The Bali document containing the type definition to be compiled.
 * @param {Boolean} verbose Whether or not the assembly instructions should be included.
 * @returns {TreeNode} The full parse tree for the Bali type.
 */
exports.compileType = function(type, verbose) {
    compiler.analyzeType(type);
    var procedures = type.getValue('$procedures');
    var iterator = procedures.iterator();
    while (iterator.hasNext()) {
        var component = iterator.getNext();
        var source = component.getValue('$source');
        var block = source.children[0];
        var procedure = block.children[0];
        var instructions = compiler.compileProcedure(procedure, type);
        var bytecode = assembler.assembleProcedure(instructions);

        var catalog = component.children[1];
        catalog.deleteKey('$instructions');
        catalog.deleteKey('$bytecode');
        if (verbose) {
            // add instructions to procedure catalog
            instructions = parser.parseExpression('"\n' + instructions.replace(/^/gm, '                ') + '\n"($mediatype: "application/basm")');
            catalog.setValue('$instructions', instructions);
        }
    
        // add bytecode to procedure catalog
        bytecode = parser.parseExpression("'" + bytecode + "\n            '" + '($base: 16, $mediatype: "application/bcod")');
        catalog.setValue('$bytecode', bytecode);
    }
    return type;
};


/**
 * This function processes a message using the Bali Virtual Machine™.
 * 
 * @param {Reference} targetReference A reference to the target that supports the message.
 * @param {Reference} typeReference A reference to the type containing the message definition.
 * @param {Symbol} message The symbol for the message to be processed.
 * @param {Collection} parameters The list or catalog of parameters that were passed with the message.
 */
exports.processMessage = function(targetReference, typeReference, message, parameters) {
    var document;
    // TODO: fill in document...
    var virtualMachine = VirtualMachine.fromDocument(document);
    virtualMachine.processInstructions();
};


/**
 * This function continues processing a previous submitted message using the
 * Bali Virtual Machine™. The task context is retrieved from the Bali Document Repository™.
 * 
 * @param {Reference} taskReference A reference to an existing task context.
 */
exports.continueProcessing = function(taskReference) {
    var virtualMachine = new VirtualMachine(taskReference);
    virtualMachine.processProcedure();
};
