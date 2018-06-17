/************************************************************************
 * Copyright (c) Crater Dog Technologies(TM).  All Rights Reserved.     *
 ************************************************************************
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.        *
 *                                                                      *
 * This code is free software; you can redistribute it and/or modify it *
 * under the terms of The MIT License (MIT), as published by the Open   *
 * Source Initiative. (See http://opensource.org/licenses/MIT)          *
 ************************************************************************/

/**
 * This collection class implements an ordered collection that does not allow duplicate items.
 * The implementation dynamically scales up and down the size of the underlying data structures as
 * the number items changes over time.
 */
var OrderedCollection = require('./OrderedCollection').OrderedCollection;


/**
 * The constructor for the Set class takes an optional collection of items to be used to
 * seed the set with initial values.
 * 
 * @param {Collection} optionalItems A collection of items that should be used to seed the set.
 */
function Set(optionalItems) {
    OrderedCollection.call(this, false);
    this.tree = new RandomizedTree();
    if (optionalItems) {
        var iterator = optionalItems.iterator();
        while (iterator.hasNext()) {
            var item = iterator.getNext();
            this.tree.insert(item);
        }
    }
    return this;
}
Set.prototype = Object.create(OrderedCollection.prototype);
Set.prototype.constructor = Set;
exports.Set = Set;


// PUBLIC METHODS

/**
 * This method returns the number of items that are currently in the set.
 * 
 * @returns {Number}
 */
Set.prototype.getSize = function() {
    return this.tree.size;
};


Set.prototype.getItem = function(index) {
    index = this.normalizedIndex(index) - 1;  // convert to javascript zero based indexing
    var item = this.tree.get(index);
    return item;
};


Set.prototype.getIndex = function(item) {
    var index = this.tree.index(item) + 1;  // convert to Bali ordinal based indexing
    return index;
};


Set.prototype.addItem = function(item) {
    var result = this.tree.insert(item);
    return result;
};


Set.prototype.removeItem = function(item) {
    var result = this.tree.remove(item);
    return result;
};


/**
 * This method removes all items from the set.
 */
Set.prototype.removeAll = function() {
    this.tree.clear();
};


/**
 * This method creates an iterator that can be used to traverse the items
 * in the set in the order.
 * 
 * @returns {Object}
 */
Set.prototype.iterator = function() {
    return new SetIterator(this);
};


/**
 * This method creates an empty set. It is used by the Collection.getItems()
 * method.
 * 
 * @returns {Set} The resulting empty set.
 */
Set.prototype.emptyCopy = function() {
    var copy = new Set();
    return copy;
};


// PUBLIC FUNCTIONS

/**
 * This function returns a new set that contains the items that are in
 * both the first set and the second set.
 *
 * @param {Set} set1 The first set to be operated on.
 * @param {Set} set2 The second set to be operated on.
 * @returns {Set} The resulting set.
 */
Set.and = function(set1, set2) {
    var result = new Set();
    var iterator = set1.iterator();
    while (iterator.hasNext()) {
        var item = iterator.getNext();
        if (set2.containsItem(item)) {
            result.addItem(item);
        }
    }
    return result;
};


/**
 * This function returns a new set that contains the items that are in
 * the first set but not in the second set.
 *
 * @param {Set} set1 The first set to be operated on.
 * @param {Set} set2 The second set to be operated on.
 * @returns {Set} The resulting set.
 */
Set.sans = function(set1, set2) {
    var result = new Set(set1);
    result.removeItems(set2);
    return result;
};


/**
 * This function returns a new set that contains all the items that are in
 * the first set or the second set or both.
 *
 * @param {Set} set1 The first set to be operated on.
 * @param {Set} set2 The second set to be operated on.
 * @returns {Set} The resulting set.
 */
Set.or = function(set1, set2) {
    var result = new Set(set1);
    result.addItems(set2);
    return result;
};


/**
 * This function returns a new set that contains all the items that are in
 * the first set or the second set but not both.
 *
 * @param {Set} set1 The first set to be operated on.
 * @param {Set} set2 The second set to be operated on.
 * @returns {Set} The resulting set.
 */
Set.xor = function(set1, set2) {
    var result = new Set();
    var iterator1 = set1.iterator();
    var item1;
    var iterator2 = set2.iterator();
    var item2;
    while (iterator1.hasNext() && iterator2.hasNext()) {
        if (item1 === undefined) item1 = iterator1.getNext();
        if (item2 === undefined) item2 = iterator2.getNext();
        var signum = item1.compareTo(item2);
        switch (signum) {
            case -1:
                result.addItem(item1);
                item1 = undefined;
                break;
            case 0:
                item1 = undefined;
                item2 = undefined;
                break;
            case 1:
                result.addItem(item2);
                item2 = undefined;
                break;
        }
    }
    return result;
};


// PRIVATE UTILITY CLASSES

function SetIterator(set) {
    this.set = set;
    this.currentIndex = 0;  // before the first item
    this.current = this.set.tree.minimum();
    return this;
}
SetIterator.prototype.constructor = SetIterator;


SetIterator.prototype.toStart = function() {
    this.currentIndex = 0;
    this.current = this.set.tree.minimum();
};


SetIterator.prototype.toIndex = function(index) {
    this.current = this.set.getItem(index);
};


SetIterator.prototype.toEnd = function() {
    this.currentIndex = this.set.tree.size;
    this.current = this.set.maximum();
};


SetIterator.prototype.hasPrevious = function() {
    return this.currentIndex > 0;
};


SetIterator.prototype.hasNext = function() {
    return this.currentIndex < this.set.tree.size;
};


SetIterator.prototype.getPrevious = function() {
    if (!this.hasPrevious()) throw new Error("The iterator is at the beginning of the set.");
    var item = this.set.tree.predecessor();
    this.currentIndex--;
    return item;
};


SetIterator.prototype.getNext = function() {
    if (!this.hasNext()) throw new Error("The iterator is at the end of the set.");
    var item = this.set.tree.successor();
    this.currentIndex++;
    return item;
};


/*
 * This class implements a randomized self balancing binary search tree structure (treap).
 * It maintains an ordering of the values in the tree and provides O(log(n)) search and
 * update performance.
 * NOTE: the values that are stored in the tree must support the this.compareTo(that)
 * method to allow proper ordering of the values in the tree.
 */

function RandomizedTree() {
    this.size = 0;
    return this;
}
RandomizedTree.prototype.constructor = RandomizedTree;


RandomizedTree.prototype.contains = function(value) {
    return this.find(value) !== undefined;
};


RandomizedTree.prototype.find = function(value) {
    var candidate = this.root;
    while (candidate && candidate.value) {
        switch (candidate.value.compareTo(value)) {
            case -1:
                candidate = candidate.left;
                break;
            case 0:
                return candidate;
            case 1:
                candidate = candidate.right;
                break;
        }
    }
    return candidate;
};

RandomizedTree.prototype.insert = function(value) {
    // handle the empty tree case
    if (this.root === undefined) {
        this.root = {value: value, priority: Math.random()};
        this.size++;
        return this.root;
    }

    // find the parent of the new node
    var parent;
    var candidate = this.root;
    while (candidate && candidate.value) {
        parent = candidate;
        switch (candidate.value.compareTo(value)) {
            case -1:
                candidate = candidate.left;
                break;
            case 0:
            case 1:
                candidate = candidate.right;
                break;
        }
    }

    // insert the new node as a child of the parent
    var child = { value: value, parent: parent, priority: Math.random()};
    switch (parent.value.compareTo(value)) {
        case -1:
            parent.left = child;
            break;
        case 0:
        case 1:
            parent.right = child;
            break;
    }

    // rebalance the tree by randomized priorities
    while (child !== this.root) {
        parent = child.parent;
        if (parent.priority < child.priority) {
            if (child === parent.left) {
                this.rotateRight(parent);
            } else {
                this.rotateLeft(parent);
            }
        } else {
            break;
        }
    }

    this.size++;
    return child;
};


RandomizedTree.prototype.remove = function(value) {
    var candidate = this.find(value);
    if (candidate) {
        // rotate the candidate down to leaf
        this.rotateDown(candidate);

        // then remove it
        if (candidate.left === undefined) {
            this.replace(candidate, candidate.right);
        } else if (candidate.right === undefined) {
            this.replace(candidate, candidate.left);
        } else {
            var successor = this.minimum(candidate.right);
            if (successor.parent !== candidate) {
                this.replace(successor, successor.right);
                successor.right = candidate.right;
                successor.right.parent = successor;
            }
            this.replace(candidate, successor);
            successor.left = candidate.left;
            successor.left.parent = successor;
        }

        // clean up
        candidate.value = undefined;
        candidate.parent = undefined;
        candidate.left = undefined;
        candidate.right = undefined;
        candidate.priority = undefined;
        this.size--;
        return true;
    } else {
        // the value was not found in the tree
        return false;
    }
};


RandomizedTree.prototype.replace = function(old, replacement) {
    if (old.parent === undefined) {
        this.root = replacement;
    } else if (old === old.parent.left) {
        old.parent.left = replacement;
    } else {
        old.parent.right = replacement;
    }
    if (replacement) {
        replacement.parent = old.parent;
    }
};


RandomizedTree.prototype.clear = function() {
    this.root = undefined;
    this.size = 0;
};


RandomizedTree.prototype.minimum = function(node) {
    while (node.left) {
        node = node.left;
    }
    return node;
};


RandomizedTree.prototype.maximum = function(node) {
    while (node.right) {
        node = node.right;
    }
    return node;
};


RandomizedTree.prototype.predecessor = function(node) {
};


RandomizedTree.prototype.predecessor = function(node) {
    if (node.left) {
        // there is a left branch, so the predecessor is the rightmost node of that subtree
        return this.maximum(node.left);
    } else {
        // it is the lowest ancestor whose right child is also an ancestor of node
        var current = node;
        var parent = node.parent;
        while (parent && current === parent.left) {
            current = parent;
            parent = parent.parent;
        }
        return parent;
    }
};


RandomizedTree.prototype.successor = function(node) {
    if (node.right) {
        // there is a right branch, so the successor is the leftmost node of that subtree
        return this.minimum(node.right);
    } else {
        // it is the lowest ancestor whose left child is also an ancestor of node
        var current = node;
        var parent = node.parent;
        while (parent && current === parent.right) {
            current = parent;
            parent = parent.parent;
        }
        return parent;
    }
};


RandomizedTree.prototype.rotateLeft = function(node) {
    var temporary = node.right;
    temporary.parent = node.parent;

    node.right = temporary.left;
    if (node.right) {
        node.right.parent = node;
    }

    temporary.left = node;
    node.parent = temporary;

    if (temporary.parent) {
        if (node === temporary.parent.left) {
            temporary.parent.left = temporary;
        } else {
            temporary.parent.right = temporary;
        }
    } else {
        root = temporary;
    }
};


RandomizedTree.prototype.rotateRight = function(node) {
    var temporary = node.left;
    temporary.parent = node.parent;

    node.left = temporary.right;
    if (node.left) {
        node.left.parent = node;
    }

    temporary.right = node;
    node.parent = temporary;

    if (temporary.parent) {
        if (node === temporary.parent.left) {
            temporary.parent.left = temporary;
        } else {
            temporary.parent.right = temporary;
        }
    } else {
        root = temporary;
    }
};


RandomizedTree.prototype.rotateDown = function(node) {
    while (true) {
        if (node.left) {
            var leftHigherPriority = node.right === undefined || node.left.priority >= node.right.priority;
            if (leftHigherPriority) {
                this.rotateRight(node);
            } else {
                this.rotateLeft(node);
            }
        } else if (node.right) {
            this.rotateLeft(node);
        } else {
            break;
        }
    }
};
