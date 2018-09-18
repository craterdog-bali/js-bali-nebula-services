/************************************************************************
 * Copyright (c) Crater Dog Technologies(TM). All Rights Reserved.    *
 ************************************************************************
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.       *
 *                                                                      *
 * This code is free software; you can redistribute it and/or modify it *
 * under the terms of The MIT License (MIT), as published by the Open   *
 * Source Initiative.(See http://opensource.org/licenses/MIT)          *
 ************************************************************************/
'use strict';

/**
 * This library encapsulates the byte encoding for the Bali virtual machine.
 * Each bytecode instruction is made up of two bytes containing three parts:
 * a three bit opcode that encodes the operation, a two bit modcode that
 * encodes the modifier, and an 11 bit operand that may be an index or
 * instruction address.  The structure of a bytecode instruction is
 * as follows:
 * <pre>
 * | opcode (3 bits) | modcode (2 bits) | operand (11 bits)
 * </pre>
 * An operand is an unsigned 11 bit number [0..2047] representing a unit
 * based index or address. The value zero is reserved for specifying an
 * invalid index or address.
 */
var types = require('bali-instruction-set/Types');
var codex = require('bali-document-notation/utilities/EncodingUtilities');


// PUBLIC FUNCTIONS

/**
 * This function takes an operation, a modifier and an operand and
 * encodes them into the corresponding instruction as a two byte number.
 *
 * @param {number} operation The operation for the bytecode.
 * @param {number} modifier The modifier for the bytecode.
 * @param {number} optionalOperand The optional operand associated with the operation.
 * @return {number} The bytecode for the instruction.
 */
exports.encodeInstruction = function(operation, modifier, optionalOperand) {
    var opcode = (operation << 13) & OPCODE_MASK;
    var modcode = (modifier << 11) & MODCODE_MASK;
    var operand = optionalOperand === undefined ? 0 : optionalOperand;
    var instruction = opcode | modcode | operand;
    return instruction;
};


/**
 * This function decodes the operation for an instruction.
 *
 * @param {number} instruction The instruction to be decoded.
 * @return {number} The decoded operation.
 */
exports.decodeOperation = function(instruction) {
    var operation = (instruction & OPCODE_MASK) >>> 13;
    return operation;
};


/**
 * This function decodes the modifier for an instruction.
 *
 * @param {number} instruction The instruction to be decoded.
 * @return {number} The decoded modifier.
 */
exports.decodeModifier = function(instruction) {
    var modifier = (instruction & MODCODE_MASK) >>> 11;
    return modifier;
};


/**
 * This function decodes the operand for an instruction.
 *
 * @param {number} instruction The instruction to be decoded.
 * @return {number} The decoded operand.
 */
exports.decodeOperand = function(instruction) {
    var operand = instruction & OPERAND_MASK;
    return operand;
};


/**
 * This function determines whether or not the operand of an instruction
 * is an address.
 *
 * @param {number} instruction The instruction to be decoded.
 * @return {boolean} Whether or not the operand is an address.
 */
exports.operandIsAddress = function(instruction) {
    var operation = exports.decodeOperation(instruction);
    var modifier = exports.decodeModifier(instruction);
    var operand = exports.decodeOperand(instruction);
    switch (operation) {
        case types.JUMP:
            return operand > 0;
        case types.PUSH:
            return modifier === types.HANDLER;
        default:
            return false;
    }
};


/**
 * This function determines whether or not the operand of an instruction
 * is an index.
 *
 * @param {number} instruction The instruction to be decoded.
 * @return {boolean} Whether or not the operand is an index.
 */
exports.operandIsIndex = function(instruction) {
    var operation = exports.decodeOperation(instruction);
    var modifier = exports.decodeModifier(instruction);
    switch (operation) {
        case types.PUSH:
            return modifier !== types.HANDLER;
        case types.LOAD:
        case types.STORE:
        case types.INVOKE:
        case types.EXECUTE:
            return true;
        default:
            return false;
    }
};


/**
 * This function determines whether or not an instruction
 * is valid.
 *
 * @param {number} instruction The instruction to be decoded.
 * @return {boolean} Whether or not the instruction is valid.
 */
exports.instructionIsValid = function(instruction) {
    var operation = exports.decodeOperation(instruction);
    var modifier = exports.decodeModifier(instruction);
    var operand = exports.decodeOperand(instruction);
    switch (operation) {
        case types.JUMP:
            // the SKIP INSTRUCTION is the only one allowed to have a zero operand
            // and only if the modifier is also zero
            return operand > 0 || modifier === 0;
        case types.PUSH:
            switch (modifier) {
                case types.HANDLER:
                case types.ELEMENT:
                case types.CODE:
                    return operand > 0;
                default:
                    return false;
            }
            break;
        case types.POP:
            switch (modifier) {
                case types.HANDLER:
                case types.COMPONENT:
                    return operand === 0;
                default:
                    return false;
            }
            break;
        case types.LOAD:
        case types.STORE:
        case types.INVOKE:
        case types.EXECUTE:
            return operand > 0;
        case types.HANDLE:
            switch (modifier) {
                case types.EXCEPTION:
                case types.RESULT:
                    return operand === 0;
                default:
                    return false;
            }
            break;
        default:
            return false;
    }
};


exports.instructionToBase16 = function(instruction) {
    var bytes = codex.shortToBytes(instruction);
    var base16 = codex.base16Encode(bytes);
    return base16;
};


exports.getInstruction = function(bytecode, address) {
    var index = (address - 1) * 4;
    var base16 = bytecode.slice(index, index + 4);
    var instruction = codex.bytesToShort(codex.base16Decode(base16));
    return instruction;
};


/**
 * This function converts a base 16 encoded byte string into a bytecode array.
 * 
 * @param {String} base16 The base 16 encoded byte string to be converted.
 * @returns {Array} The corresponding bytecode array.
 */
exports.base16ToBytecode = function(base16) {
    var bytes = codex.base16Decode(base16);
    var bytecode = [];
    for (var i = 0; i < bytes.length; i += 2) {
        var word = codex.bytesToShort(bytes.slice(i));
        bytecode.push(word);
    }
    return bytecode;
};


/**
 * This function converts a bytecode array into a byte string.
 * 
 * @param {Array} bytecode The bytecode array to be converted.
 * @param {String} indentation The indentation string to be prefixed to each line. 
 * @returns {String} The base 16 encoded byte string.
 */
exports.bytecodeTobase16 = function(bytecode, indentation) {
    var bytes = '';
    for (var i = 0; i < bytecode.length; i++) {
        bytes += codex.shortToBytes(bytecode[i]);
    }
    var base16 = codex.base16Encode(bytes, indentation);
    return base16;
};


/**
 * This function returns a human readable version of Bali virtual machine bytecode.
 * 
 * @param {String} bytecode The base 16 encoded bytecode instructions.
 * @returns {String} The human readable form of the bytecode.
 */
exports.bytecodeAsString = function(bytecode) {
    var string = ' Addr     Bytes   Bytecode                  Instruction\n';
    string += '----------------------------------------------------------------------\n';
    var address = 1;  // Bali unit based addressing
    while (address * 4 <= bytecode.length) {
        var instruction = exports.getInstruction(bytecode, address);
        string += wordAsString(address, instruction) + '\n';
        address++;
    }
    return string;
};


/**
 * This function takes an instruction and formats it into a human readable
 * version of a Bali virtual machine instruction.
 *
 * @param {Number} instruction The instruction to be formatted.
 * @param {String} optionalOperand An optional label, symbol, or element as operand.
 * @return {String} The human readable form of the instruction.
 */
exports.instructionAsString = function(instruction, optionalOperand) {
    var operation = exports.decodeOperation(instruction);
    var modifier = exports.decodeModifier(instruction);

    var operand = exports.decodeOperand(instruction);
    if (optionalOperand !== undefined) {
        operand = optionalOperand;
    } else if (exports.operandIsAddress(instruction)) {
        operand = addressAsString(operand);
    } else if (exports.operandIsIndex(instruction)) {
        operand = indexAsString(operand);
    }

    var string = types.OPERATION_TYPES[operation] + ' ';
    switch (operation) {
        case types.JUMP:
            if (modifier === 0 && operand === 0) {
                string = 'SKIP INSTRUCTION';
            } else {
                string += 'TO ' + operand;
                if (modifier > 0) string += ' ' + types.JUMP_MODIFIERS[modifier];
            }
            break;
        case types.PUSH:
            string += types.PUSH_MODIFIERS[modifier] + ' ' + operand;
            break;
        case types.POP:
            string += types.POP_MODIFIERS[modifier];
            break;
        case types.LOAD:
            string += types.LOAD_MODIFIERS[modifier] + ' ' + operand;
            break;
        case types.STORE:
            string += types.STORE_MODIFIERS[modifier] + ' ' + operand;
            break;
        case types.INVOKE:
            string += operand;
            if (modifier === 1) string += ' WITH PARAMETER';
            if (modifier > 1) string += ' WITH ' + modifier + ' PARAMETERS';
            break;
        case types.EXECUTE:
            string += operand;
            if (modifier > 0) string += ' ' + types.EXECUTE_MODIFIERS[modifier];
            break;
        case types.HANDLE:
            string += types.HANDLE_MODIFIERS[modifier];
            break;
    }
    return string;
};


// PRIVATE CONSTANTS

// masks
var OPCODE_MASK = 0xE000;
var MODCODE_MASK = 0x1800;
var OPERAND_MASK = 0x07FF;


// PRIVATE FUNCTIONS

/**
 * This function returns the canonical string format for an index to a
 * literal value or symbol.
 * 
 * @param {number} index The index to be formatted.
 * @returns {string} The canonical string representation of the index.
 */
function indexAsString(index) {
    var string = index.toString();
    return string;
}


/**
 * This function returns the canonical string format for a Bali virtual
 * machine address in hexidecimal [000..3FF].
 * 
 * @param {number} address The virtual machine address.
 * @returns {string} The canonical string representation of the address.
 */
function addressAsString(address) {
    var string = address.toString(16).toUpperCase();
    while (string.length < 3) string = '0' + string;
    string = '[' + string + ']';
    return string;
}


/**
 * This function returns a human readable version of a Bali virtual machine
 * 16 bit (word) bytecode instruction.
 * 
 * @param {number} address The address of the instruction.
 * @param {number} instruction The 16 bit bytecode instruction to be formatted.
 * @returns {string} The human readable form of the bytecode instruction.
 */
function wordAsString(address, instruction) {
    address = addressAsString(address);
    var operation = exports.decodeOperation(instruction);
    var modifier = exports.decodeModifier(instruction);
    var operand = exports.decodeOperand(instruction);
    if (exports.operandIsAddress(instruction)) {
        operand = addressAsString(operand);
    } else {
        operand = indexAsString(operand);
    }

    // format the instruction as hexadecimal bytes
    var bytes = instruction.toString(16).toUpperCase();
    while (bytes.length < 4) bytes = '0' + bytes;

    // format the description
    var description = exports.instructionAsString(instruction);

    // format the bytecode
    while (operand.length < 5) operand = ' ' + operand;  // pad operand string with spaces
    var bytecode = '' + operation + modifier + ' ' + operand;

    // put them all together
    var formatted = address + ':    ' + bytes + '    ' + bytecode + '    ' + description;
    return formatted;
}
