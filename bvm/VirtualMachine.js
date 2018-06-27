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
 * This class defines the Bali Virtual Machine™.
 */
var language = require('bali-language/BaliLanguage');
var intrinsics = require('../intrinsics/IntrinsicFunctions');
var elements = require('../elements');
var collections = require('../collections');
var bytecode = require('../utilities/BytecodeUtilities');
var generator = require('../transformers/ParseTreeGenerator');
var TaskContext = require('./TaskContext');
var ProcedureContext = require('./ProcedureContext');
// var cloud = require('bali-cloud-api');
var cloud = {
    readDocument: function(reference) {
        console.log('readDocument(' + reference + ')');
    },
    checkoutDocument: function(reference) {
        console.log('checkoutDocument(' + reference + ')');
    },
    saveDraft: function(reference, document) {
        console.log('saveDraft(' + reference + ', ' +  document + ')');
    },
    discardDraft: function(reference) {
        console.log('discardDraft(' + reference + ')');
    },
    commitDocument: function(reference, document) {
        console.log('commitDocument(' + reference + ', ' +  document + ')');
    },
    receiveMessage: function(reference) {
        console.log('receiveMessage(' + reference + ')');
    },
    sendMessage: function(reference, message) {
        console.log('sendMessage(' + reference + ', ' +  message + ')');
    },
    publishEvent: function(event) {
        console.log('publishEvent(' + event + ')');
    }
};



/**
 * This constructor creates a new Bali Virtual Machine™ using a reference to an existing
 * task context if possible.
 * 
 * @param {Reference} taskReference A reference to an existing task context.
 * @returns {VirtualMachine} The new virtual machine.
 */
function VirtualMachine(taskReference) {
    if (taskReference) {
        this.taskReference = taskReference;
        this.taskContext = cloud.readDraft(taskReference);
        this.procedureContext = this.taskContext.procedures.getTop();
    } else {
        this.taskReference = new elements.Reference('bali:/' + new elements.Tag());
        this.taskContext = new TaskContext();
    }
    return this;
}
VirtualMachine.prototype.constructor = VirtualMachine;
exports.VirtualMachine = VirtualMachine;


// machine states
VirtualMachine.ACTIVE = new elements.Symbol('$active');
VirtualMachine.WAITING = new elements.Symbol('$waiting');
VirtualMachine.DONE = new elements.Symbol('$done');


/**
 * This method processes the instructions in the current task until the end of the
 * instructions is reached or the task is waiting to receive a message from a queue
 * If the virtual machine is in a single step mode, then this method processes the
 * next instruction only.
 */
VirtualMachine.prototype.processInstructions = function() {
    // process the instructions
    while (this.taskContext.status === VirtualMachine.ACTIVE) {
        // fetch the next instruction
        var instruction = this.fetchNextInstruction();
        // execute the next instruction
        this.executeNextInstruction(instruction);
        // check for single step mode
        if (this.taskContext.singleStep === elements.Probability.TRUE) break;  // after a each instruction
    }
    // determine the outcome of the processing
    if (this.taskContext.status === VirtualMachine.DONE) {
        // the task completed successfully or with an exception so notify any interested parties
        this.publishCompletionEvent();
    } else {
        // waiting on a message from a queue or single stepping so save the task state in the
        // cloud document repository
        this.saveTaskState();
    }
};


/**
 * This method fetches the next bytecode instruction from the current procedure context.
 * 
 * @returns {Number} The next 16 bit bytecode instruction.
 */
VirtualMachine.prototype.fetchNextInstruction = function() {
    // increment the address pointer
    var address = new elements.Complex(this.procedureContext.address.real + 1);
    this.procedureContext.address = address;
    // load the next instruction from the current procedure context
    var instruction = this.procedureContext.instructions.getItem(address).real;
    return instruction;
};


/**
 * This method executes the next bytecode instruction.
 * 
 * @param {Number} instruction The 16 bit bytecode instruction to be executed.
 */
VirtualMachine.prototype.executeNextInstruction = function(instruction) {
    // decode the bytecode instruction
    var operation = bytecode.decodeOperation(instruction);
    var modifier = bytecode.decodeModifier(instruction);
    var operand = bytecode.decodeOperand(instruction);
    // pass execution off to the correct operation handler
    var index = (operation << 2) | modifier;
    this.instructionHandlers[index](operand);
};


/**
 * This method publishes a task completion event to the global event queue.
 */
VirtualMachine.prototype.publishCompletionEvent = function() {
    var event = '[\n' +
        '    $type: $completion\n' +
        '    $task: ' + this.taskReference + '\n' +
        '    $result: ' + this.result + '\n' +
        '    $exception: ' + this.exception + '\n' +
        ']';
    cloud.publishEvent(event);
};


VirtualMachine.prototype.saveTaskState = function() {
    // generate a parse tree from the task context
    var tree = generator.generateParseTree(this.taskContext);
    // format the parse tree into a document
    var context = language.formatParseTree(tree);
    // save the document in the cloud
    cloud.writeDraft(this.taskReference, context);
};


VirtualMachine.prototype.instructionHandlers = [
    // JUMP TO label
    function(operand) {
        var address = operand;
        // if the address is not zero then use it as the next instruction to be executed,
        // otherwise it is a SKIP INSTRUCTION (aka NOOP)
        if (address > 0) {
            this.procedureContext.address = new elements.Complex(address);
        }
    },

    // JUMP TO label ON NONE
    function(operand) {
        var address = operand;
        // pop the condition component off the component stack
        var component = this.procedureContext.components.popItem();
        // if the condition is 'none' then use the address as the next instruction to be executed
        if (component === elements.Template.NONE) {
            this.procedureContext.address = new elements.Complex(address);
        }
    },

    // JUMP TO label ON TRUE
    function(operand) {
        var address = operand;
        // pop the condition component off the component stack
        var component = this.procedureContext.components.popItem();
        // if the condition is 'true' then use the address as the next instruction to be executed
        if (component === elements.Probability.TRUE) {
            this.procedureContext.address = new elements.Complex(address);
        }
    },

    // JUMP TO label ON FALSE
    function(operand) {
        var address = operand;
        // pop the condition component off the component stack
        var component = this.procedureContext.components.popItem();
        // if the condition is 'false' then use the address as the next instruction to be executed
        if (component === elements.Probability.FALSE) {
            this.procedureContext.address = new elements.Complex(address);
        }
    },

    // PUSH HANDLER label
    function(operand) {
        var address = new elements.Complex(operand);
        // push the address of the current exception handlers onto the handlers stack
        this.procedureContext.handlers.pushItem(address);
    },

    // PUSH ELEMENT literal
    function(operand) {
        // lookup the literal associated with the index operand
        var index = operand;
        var literal = this.procedureContext.symbols.literals[index];
        // create a new element from the literal and push it on top of the component stack
        var element = language.parseElement(literal);
        this.procedureContext.components.pushItem(element);
    },

    // PUSH CODE literal
    function(operand) {
        // lookup the literal associated with the index operand
        var index = operand;
        var literal = this.procedureContext.symbols.literals[index];
        // create a new code parse tree from the literal and push it on top of the component stack
        var code = language.parseProcedure(literal);
        this.procedureContext.components.pushItem(code);
    },

    // UNIMPLEMENTED PUSH OPERATION
    function(operand) {
        throw new Error('An unimplemented PUSH operation was attempted: 13');
    },

    // POP HANDLER
    function(operand) {
        // remove the current exception handler address from the top of the handlers stack
        // since it is no longer in scope
        this.procedureContext.handlers.popItem();
    },

    // POP COMPONENT
    function(operand) {
        // remove the component that is on top of the component stack since it was not used
        this.procedureContext.components.popItem();
    },

    // UNIMPLEMENTED POP OPERATION
    function(operand) {
        throw new Error('An unimplemented POP operation was attempted: 22');
    },

    // UNIMPLEMENTED POP OPERATION
    function(operand) {
        throw new Error('An unimplemented POP operation was attempted: 23');
    },

    // LOAD VARIABLE symbol
    function(operand) {
        // lookup the variable associated with the index operand
        var index = operand;
        var variable = this.procedureContext.symbols.variables[index];
        // push the value of the variable on top of the component stack
        this.procedureContext.components.pushItem(variable);
    },

    // LOAD DOCUMENT symbol
    function(operand) {
        // lookup the reference associated with the index operand
        var index = operand;
        var reference = this.procedureContext.symbols.references[index];
        // read the referenced document from the cloud repository
        var document = cloud.readDocument(reference);
        // push the document on top of the component stack
        this.procedureContext.components.pushItem(document);
    },

    // LOAD DRAFT symbol
    function(operand) {
        // lookup the reference associated with the index operand
        var index = operand;
        var reference = this.procedureContext.symbols.references[index];
        // read the referenced draft from the cloud repository
        var draft = cloud.readDraft(reference);
        // push the document on top of the component stack
        this.procedureContext.components.pushItem(draft);
    },

    // LOAD MESSAGE symbol
    function(operand) {
        // lookup the referenced queue associated with the index operand
        var index = operand;
        var queue = this.getReference(index);
        // attempt to receive a message from the referenced queue in the cloud
        var message = cloud.receiveMessage(queue);
        if (message) {
            this.procedureContext.components.pushItem(message);
        } else {
            // set the task status to 'waiting'
            this.procedureContext.status = VirtualMachine.WAITING;
            // make sure that the same instruction will be tried again
            this.procedureContext.address--;
        }
    },

    // STORE VARIABLE symbol
    function(operand) {
        // pop the component that is on top of the component stack off the stack
        var component = this.procedureContext.components.popItem();
        // and store the component in the variable associated with the index operand
        var index = operand;
        this.procedureContext.symbols.variables[index] = component;
    },

    // STORE DOCUMENT symbol
    function(operand) {
        // pop the document that is on top of the component stack off the stack
        var document = this.procedureContext.components.popItem();
        // lookup the reference associated with the index operand
        var index = operand;
        var reference = this.procedureContext.symbols.references[index];
        // write the referenced document to the cloud repository
        cloud.writeDocument(reference, document);
    },

    // STORE DRAFT symbol
    function(operand) {
        // pop the draft that is on top of the component stack off the stack
        var draft = this.procedureContext.components.popItem();
        // lookup the reference associated with the index operand
        var index = operand;
        var reference = this.procedureContext.symbols.references[index];
        // write the referenced draft to the cloud repository
        cloud.writeDraft(reference, draft);
    },

    // STORE MESSAGE symbol
    function(operand) {
        // pop the message that is on top of the component stack off the stack
        var message = this.procedureContext.components.popItem();
        // lookup the referenced queue associated with the index operand
        var index = operand;
        var queue = this.procedureContext.symbols.references[index];
        // send the message to the referenced queue in the cloud
        cloud.sendMessage(queue, message);
    },

    // INVOKE symbol
    function(operand) {
        // create an empty parameters list for the intrinsic function call
        var parameters = [];
        // call the intrinsic function associated with the index operand
        var index = operand;
        var result = intrinsics.intrinsicFunctions[index - 1].apply(this, parameters);  // js zero based indexing
        // push the result of the function call onto the top of the component stack
        this.procedureContext.components.pushItem(result);
    },

    // INVOKE symbol WITH PARAMETER
    function(operand) {
        // pop the parameters to the intrinsic function call off of the component stack
        var parameters = [];
        parameters.pushItem(this.procedureContext.components.popItem());
        // call the intrinsic function associated with the index operand
        var index = operand;
        var result = intrinsics.intrinsicFunctions[index - 1].apply(this, parameters);  // js zero based indexing
        // push the result of the function call onto the top of the component stack
        this.procedureContext.components.pushItem(result);
    },

    // INVOKE symbol WITH 2 PARAMETERS
    function(operand) {
        // pop the parameters to the intrinsic function call off of the component stack
        var parameters = [];
        parameters.pushItem(this.procedureContext.components.popItem());
        parameters.pushItem(this.procedureContext.components.popItem());
        // call the intrinsic function associated with the index operand
        var index = operand;
        var result = intrinsics.intrinsicFunctions[index - 1].apply(this, parameters);  // js zero based indexing
        // push the result of the function call onto the top of the component stack
        this.procedureContext.components.pushItem(result);
    },

    // INVOKE symbol WITH 3 PARAMETERS
    function(operand) {
        // pop the parameters to the intrinsic function call off of the component stack
        var parameters = [];
        parameters.pushItem(this.procedureContext.components.popItem());
        parameters.pushItem(this.procedureContext.components.popItem());
        parameters.pushItem(this.procedureContext.components.popItem());
        // call the intrinsic function associated with the index operand
        var index = operand;
        var result = intrinsics.intrinsicFunctions[index - 1].apply(this, parameters);  // js zero based indexing
        // push the result of the function call onto the top of the component stack
        this.procedureContext.components.pushItem(result);
    },

    // EXECUTE symbol
    function(operand) {
        // set the target component to null since there isn't one
        var target = null;
        // pop the type reference for the procedure call off of the component stack
        var reference = this.procedureContext.components.popItem();
        // read the referenced type from the cloud repository
        var type = cloud.readDocument(reference);
        // lookup the procedure associated with the index operand
        var index = operand;
        var procedure = this.procedureContext.symbols.procedures[index];
        // create an empty parameters list for the procedure call
        var parameters = [];
        // create a new context for the procedure call
        var context = new ProcedureContext(target, type, procedure, parameters);
        // make the new context the current context for this VM
        this.procedureContext = context;
        this.taskContext.procedures.pushItem(context);
    },

    // EXECUTE symbol WITH PARAMETERS
    function(operand) {
        // set the target component to null since there isn't one
        var target = null;
        // pop the type reference for the procedure call off of the component stack
        var reference = this.procedureContext.components.popItem();
        // read the referenced type from the cloud repository
        var type = cloud.readDocument(reference);
        // lookup the procedure associated with the index operand
        var index = operand;
        var procedure = this.procedureContext.symbols.procedures[index];
        // pop the parameters to the procedure call off of the component stack
        var parameters = this.procedureContext.components.popItem();
        // create a new context for the procedure call
        var context = new ProcedureContext(target, type, procedure, parameters);
        // make the new context the current context for this VM
        this.procedureContext = context;
        this.taskContext.procedures.pushItem(context);
    },

    // EXECUTE symbol ON TARGET
    function(operand) {
        // pop the target component for the procedure call off of the component stack
        var target = this.procedureContext.components.popItem();
        // retrieve a reference to the type of the target component
        var parameters = [target];
        var reference = intrinsics.intrinsicFunctions[intrinsics.GET_TYPE].apply(this, parameters);
        // read the referenced type from the cloud repository
        var type = cloud.readDocument(reference);
        // lookup the procedure associated with the index operand
        var index = operand;
        var procedure = this.procedureContext.symbols.procedures[index];
        // create an empty parameters list for the procedure call
        parameters = [];
        // create a new context for the procedure call
        var context = new ProcedureContext(target, type, procedure, parameters);
        // make the new context the current context for this VM
        this.procedureContext = context;
        this.taskContext.procedures.pushItem(context);
    },

    // EXECUTE symbol ON TARGET WITH PARAMETERS
    function(operand) {
        // pop the target component for the procedure call off of the component stack
        var target = this.procedureContext.components.popItem();
        // retrieve a reference to the type of the target component
        var parameters = [target];
        var reference = intrinsics.intrinsicFunctions[intrinsics.GET_TYPE].apply(this, parameters);
        // read the referenced type from the cloud repository
        var type = cloud.readDocument(reference);
        // lookup the procedure associated with the index operand
        var index = operand;
        var procedure = this.procedureContext.symbols.procedures[index];
        // pop the parameters to the procedure call off of the component stack
        parameters = this.procedureContext.components.popItem();
        // create a new context for the procedure call
        var context = new ProcedureContext(target, type, procedure, parameters);
        // make the new context the current context for this VM
        this.procedureContext = context;
        this.taskContext.procedures.pushItem(context);
    },

    // HANDLE EXCEPTION
    function(operand) {
        // pop the current exception off of the component stack
        var exception = this.procedureContext.components.popItem();
        while (this.taskContext.procedures.length > 0 &&
                this.procedureContext.handlers.length === 0) {
            // pop the current context off of the context stack since it has no handlers
            this.taskContext.procedures.popItem();
            this.procedureContext = this.taskContext.procedures.getTop();
        }
        // TODO: need to check for no more contexts
        // push the current exception onto the top of the component stack
        this.procedureContext.components.pushItem(exception);
        // retrieve the address of the current exception handlers
        var address = this.procedureContext.handlers.popItem();
        // use that address as the next instruction to be executed
        this.procedureContext.address = address;
    },

    // HANDLE RESULT
    function(operand) {
        // pop the result of the procedure call off of the component stack
        var result = this.procedureContext.components.popItem();
        // pop the current context off of the context stack since it is now out of scope
        this.taskContext.procedures.popItem();
        this.procedureContext = this.taskContext.procedures.getTop();
        // push the result of the procedure call onto the top of the component stack
        this.procedureContext.components.pushItem(result);
    },

    // UNIMPLEMENTED HANDLE OPERATION
    function(operand) {
        throw new Error('An unimplemented HANDLE operation was attempted: 72');
    },

    // UNIMPLEMENTED HANDLE OPERATION
    function(operand) {
        throw new Error('An unimplemented HANDLE operation was attempted: 73');
    }

];
