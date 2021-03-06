
var Pos = CodeMirror.Pos;

var Project = Format.Project;

function getEl(view) {
  return view.el;
}

function doNext(cb) {
  setTimeout(function() { cb() }, 0);
}

function windowTop(element) {
  var y = 0;
  do {
    y += element.offsetTop || 0;
    element = element.parentNode;
  } while (element);
  return y;
}

function copyKeyMap(d) {
  return JSON.parse(JSON.stringify(d));
}

/*****************************************************************************/

var windowSize = ko();
var onResize = function() {
  windowSize.assign({
    width: window.innerWidth,
    height: window.innerHeight,
  });
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
onResize();

/*****************************************************************************/

var Scriptable = function(s, project) {
  this.sprite = s;
  this.project = project;

  this.scriptsEditor = new ScriptsEditor(s, project);
  s._scriptsEditor = this.scriptsEditor;

  function pane(name, content) {
    return el('.pane.pane-'+name, {
      class: ko(function() { if (App.tab() === name) return 'pane-active'; }),
      children: content,
    });
  }

  this.el = el('.scriptable', {
    class: ko(function() { return App.active() === s ? 'scriptable-active' : '' }),
    children: [
      el('.tabs', ['data', 'costumes', 'sounds'].map(function(name) {
        var tabName = name;
        if (name === 'costumes' && s._isStage) tabName = 'backdrops';
        return el('li.tab', {
          class: ko(function() { if (App.tab() === name) return 'tab-active'; }),
          on_click: function(e) {
            App.tab.assign(name);
          },
          children: el('span', tabName),
        });
      })),

      pane('data', s._isStage ? [
        el('h2', "Variable names"),
        new NamesEditor(s, 'variable').el,
        el('hr'),
        el('h2', "List names"),
        new NamesEditor(s, 'list').el,
      ] : [
        el('h2', "Variable names"),
        new NamesEditor(project, 'variable').el,
        new NamesEditor(s, 'variable').el,
        el('hr'),
        el('h2', "List names"),
        new NamesEditor(project, 'list').el,
        new NamesEditor(s, 'list').el,
      ]),
      pane('costumes', new ListEditor(s, 'costume').el),
      pane('sounds', new ListEditor(s, 'sound').el),

      s._scriptsEditor.el,
    ],
  });
};

Scriptable.prototype.activated = function() {
  this.scriptsEditor.activated();
};

Scriptable.prototype.focus = function() {
  this.scriptsEditor.focus();
};

Scriptable.prototype.deactivated = function() {
  this.scriptsEditor.repaint();
};

/* ListEditor */

function uniqueName(name, items) {
  var seen = seenNames(items);
  var m = /^(.*)([0-9]+)$/.exec(name);
  var suffix = m ? +m[2] : 2;
  var original = (m ? m[1] : name) || 'costume';
  while (seen.hasOwnProperty(name)) {
    name = original + suffix++;
  }
  return name;
}

function costumeSize(costume) {
  var stats = ko("..x..");
  costume._size.subscribe(function(size) {
    if (!size) return;
    var width = size.width / (costume.bitmapResolution || 1);
    var height = size.height / (costume.bitmapResolution || 1);
    var result = width + "x" + height;
    if (result === "0x0") result = "";
    stats.assign(result);
  });
  return stats;
}

function costumeThumbnail(costume) {
  var thumb = el('.thumb');
  ko.subscribe(costume, function(costume) {
    if (!costume) return;
    costume._src.subscribe(function(src) {
      thumb.style.backgroundImage = 'url(' + src + ')';
    });
  });
  return thumb;
}

var renderItem = {
  sprite: function(sprite, _, onNameBlur) {
    var costume = ko(function() {
      var index = sprite.currentCostumeIndex();
      var c = sprite.costumes()[index || 0] || sprite.costumes()[0];
      return c;
    });
    return el('.details', [
      costumeThumbnail(costume),
      el('.name-wrap', el('input.name', {
        value: sprite.objName,
        readOnly: sprite._isStage || sprite._editingName.negate(),
        on_blur: onNameBlur,
        class: ko(function() {
          if (!sprite._isStage && sprite._editingName()) return 'name-editing';
        }),
        on_keydown: function(e) {
          if (e.keyCode === 13) {
            this.blur();
          } else if (e.keyCode === 27) {
            this.value = sprite.objName();
            this.blur();
          }
        },
      })),
    ]);
  },
  costume: function(costume, sprite, onNameBlur) {
    var size = costume._size;
    return el('.details', [
      costumeThumbnail(costume),
      el('input.name', {
        value: costume.name,
        on_blur: onNameBlur,
      }),
      el('.media-number', ko(function() {
        return "#" + (sprite.costumes().indexOf(costume) + 1);
      })),
      el('.media-stats', costumeSize(costume)),
    ]);
  },
  sound: function(sound, sprite, onNameBlur) {
    return el('.details', [
      // el('.thumb', sound._$audio), // TODO fix <audio>
      el('input.name', {
        value: sound.name,
        on_blur: onNameBlur,
      }),
      el('.media-number', ko(function() {
        return "#" + (sprite.sounds().indexOf(sound) + 1);
      })),
    ]);
  },
};

var newItem = {
  sprite: Project.newSprite,
  costume: Project.newCostume,
  sound: Project.newSound,
};

var ListEditor = function(obj, kind, active) {
  this.kind = kind;
  this.obj = obj;
  this.active = active;
  var items = this.items = obj[kind + 's'];

  if (kind === 'sprite') {
    this.displayItems = items.compute(function(sprites) {
      return [obj].concat(sprites);
    });
  } else {
    this.displayItems = items;
  }

  var itemEls = this.displayItems.map(function(item) {
    return new ListEditorItem(item, this).el;
  }.bind(this));

  var newButton;
  if (kind === 'sprite') {
    newButton = el('.sprite.sprite-new', {
      text: "＋ new sprite",
      on_click: function() {
        var sprite = Project.newSprite();
        var name = "turtle";
        var number = 2;
        var p = App.project();
        while (p._spriteNames().indexOf(name) !== -1) {
          name = "turtle" + (number++);
        }
        sprite.objName.assign(name);

        Oops(function() {
          App.project().sprites.push(sprite);
          App.project().children.push(sprite);
        });

        App.active.assign(sprite);
      },
    });
  } else if (kind === 'costume' && obj._isStage) {
    var colorInput;
    newButton = el('.costume.costume-new', {
      on_click: function(e) {
        if (e.target === colorInput) return;

        var name = colorInput.value.slice(1);

        var canvas = el('canvas', {
          width: 480,
          height: 360,
        });
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = colorInput.value;
        ctx.fillRect(0, 0, 480, 360);
        var base64 = canvas.toDataURL('image/png').split(',')[1];
        var binary = atob(base64);
        var ab = Format.binaryToArrayBuffer(binary);

        var costume = Project.newCostume(name, 'png', ab);

        Oops(function() {
          obj.costumes.push(costume);
          obj.currentCostumeIndex.assign(obj.costumes().indexOf(costume));
        });
      },
      children: [
        el('span', "＋ new backdrop"),
        colorInput = el('input', {
          type: 'color',
          value: "#FBF0E3",
        }),
      ],
    });
  } else {
    newButton = el('.' + kind + '.drag-here', "drag here to import");
  }
  if (kind !== 'sound') {
    itemEls = itemEls.compute(function(els) {
      return els.concat([newButton]);
    });
  } else {
    itemEls = itemEls.compute(function(els) {
      return els.length ? els.slice()
                        : [el('.sound.drag-here', "no sounds here")];
    });
  }

  this.dragging = null;
  this.itemHeight = ListEditor.itemHeights[kind];
  window.addEventListener('mousemove', this.pointerMove.bind(this));
  window.addEventListener('mouseup', this.drop.bind(this));
  doNext(function() {
    this.el.parentNode.addEventListener('wheel', this.pointerMove.bind(this));
  }.bind(this));

  // scroll to bottom on push (eg. import costume)
  items.subscribe({
    insert: function(index, item) {
      if (item._el) item._el.scrollIntoView();
      doNext(function() {
        item._el.scrollIntoView();
      });
    },
  });

  this.el = el('ul.items', {
    class: 'items-' + kind + 's',
    children: itemEls,
  });
};

ListEditor.itemHeights = {
  sprite: 25,
  costume: 83,
  sound: 64,
};

ListEditor.prototype.pointerMove = function(e) {
  if (!this.dragging) return;
  if (this.kind !== 'sprite' && App.active() !== this.obj) return;

  var clientY = e.clientY || this.dragging.lastClientY;
  this.dragging.lastClientY = clientY;

  var mouseY = clientY - windowTop(this.el) + this.el.parentNode.scrollTop;
  if (mouseY === this.dragging.lastMouseY) return;
  this.dragging.lastMouseY = mouseY;

  var top = mouseY + this.dragging.offsetY;
  top = Math.max(0, top);
  this.dragging.el.style.top = top + "px";

  // work out position
  top -= 4;
  var itemIndex = top / this.itemHeight;
  itemIndex = Math.round(itemIndex);
  itemIndex = Math.min(itemIndex, this.displayItems().length - 1);
  if (this.kind === 'sprite' && itemIndex < 1) itemIndex = 1;

  // move placeholder if necessary
  if (itemIndex !== this.dragging.index) {
    var placeholder = this.dragging.placeholder;
    this.el.removeChild(placeholder);
    var itemEl = this.el.children[itemIndex];
    if (itemEl) {
      this.el.insertBefore(placeholder, itemEl);
    } else {
      this.el.appendChild(placeholder);
    }
    this.dragging.index = itemIndex;
  }
};

ListEditor.prototype.dragTick = function() {
  if (!this.dragging) return;
  if (!this.dragging.lastMouseY) return;
  var SPEED = 0.08;

  // hold at edge to auto-scroll
  var mouseViewportY = this.dragging.lastClientY - windowTop(this.el);
  this.dragging.scrollSpeed *= 0.8;
  if (mouseViewportY < 0) {
    this.dragging.scrollSpeed -= SPEED;
  } else if (mouseViewportY > this.el.parentNode.offsetHeight) {
    this.dragging.scrollSpeed += SPEED;
  } else {
    // slow down
    this.dragging.scrollSpeed *= 0.1;
  }

  this.el.parentNode.scrollTop += this.dragging.scrollSpeed * this.itemHeight;
}

ListEditor.prototype.drop = function() {
  if (!this.dragging) return;

  var item = this.dragging.item;
  var oldIndex = this.items().indexOf(item);
  var newIndex = this.kind === 'sprite' ? this.dragging.index - 1 : this.dragging.index;
  var newItems = this.items().slice();
  newItems.splice(oldIndex, 1);
  newItems.splice(newIndex, 0, item);
  // get stopDragging to put it back in the right place
  this.dragging.resetIndex = this.dragging.index;

  this.stopDragging();

  // This refreshes the entire pane, so must happen *after* stopDragging
  Oops(function() {
    this.items.assign(newItems);
  }.bind(this));
};

ListEditor.prototype.stopDragging = function() {
  if (!this.dragging) return;

  this.el.removeChild(this.dragging.placeholder); // TODO

  this.el.removeChild(this.dragging.el);
  this.el.insertBefore(this.dragging.el, this.el.children[this.dragging.resetIndex]);

  this.dragging.el.classList.remove('dragging');
  this.dragging.el.style.top = "";
  clearInterval(this.dragging.interval);
  this.dragging = null;
};

ListEditor.prototype.pointerDown = function(e, item) {
  if (this.dragging) {
    this.stopDragging();
    return;
  }

  var placeholder = el('li.' + this.kind + '.drag-placeholder', " ");
  var index = this.displayItems().indexOf(item);
  var itemEl = this.el.children[index];
  this.el.insertBefore(placeholder, itemEl);

  var mouseY = e.clientY - windowTop(this.el) + this.el.parentNode.scrollTop;
  var top = itemEl.offsetTop - this.itemHeight; // subtract size of placeholder
  // nb. mouseY + offsetY = top
  assert(top > -2);

  this.dragging = {
    item: item,
    el: itemEl,
    placeholder: placeholder,
    offsetY: top - mouseY,
    index: index,
    resetIndex: index,
    lastClientY: e.clientY,
    lastMouseY: null,
    interval: setInterval(this.dragTick.bind(this), 20),
    scrollSpeed: 0,
  };
  itemEl.classList.add('dragging');
  itemEl.style.top = top + "px";

  // move dragged element to end
  this.el.removeChild(itemEl);
  this.el.appendChild(itemEl);
};


var ListEditorItem = function(item, listEditor) {
  this.item = item;
  this.editor = listEditor;

  var kind = listEditor.kind;
  var items = listEditor.items;
  var obj = listEditor.obj;
  var active = listEditor.active;

  item._name = item.objName;

  var props = {};
  var buttons = [];

  if (kind === 'sprite') {
    props.class = active.compute(function(active) {
      var classes = [];
      if (active === item) classes.push('sprite-active');
      if (item._hasErrors()) classes.push('has-errors');
      return classes;
    });
    props.on_click = function(e) {
      if (e.target.classList.contains('button')) return;
      active.assign(item);
    };

    if (!item._isStage) {
      buttons.push(el('.button.button-edit', {
        on_click: function(e) {
          item._editingName.toggle();
          if (item._editingName()) {
            item._el.querySelector('input.name').focus();
          }
        },
      }));
    }
  }

  this.dragHandle = null;
  if (!item._isStage) {
    buttons.push(el('.button.button-remove', {
      on_click: removeItem,
      disabled: ko(function() {
        // can't remove last costume
        return kind === 'costume' && items().length === 1;
      }),
    }));
    buttons.push(this.dragHandle = el('.button.button-handle', {
      on_mousedown: this.pointerDown.bind(this),
    }));
  }

  function removeItem() {
    if (this.disabled) return;
    Oops(function() {
      var index = items().indexOf(item);
      assert(index !== -1);

      // update costume index if needed
      if (kind === 'costume') {
        if (obj.currentCostumeIndex() >= index) {
          obj.currentCostumeIndex.assign(Math.max(0, index - 1));
        }
      }

      // remove
      items.remove(index);

      // remove sprite from children array too
      if (kind === 'sprite') {
        obj.children.remove(obj.children().indexOf(item));

        if (App.active() === item) {
          App.active.assign(items()[index] || items()[index - 1] || App.project());
        }
      }
    });
  }

  function onNameBlur(e, name) {
    var name = name || this.value;
    var observable = item.name || item._name;

    if (kind === 'sprite' && !item._isStage) {
      item._editingName.assign(false);
    }

    // name can't be empty
    if (!name) name = observable();

    // name must be unique
    var others = items().slice();
    others.splice(others.indexOf(item), 1);
    name = uniqueName(name, others);
    this.value = name;

    Oops(function() {
      observable.assign(name);
    });
  }

  // build children
  var render = renderItem[kind];
  props.children = [
    render(item, obj, onNameBlur),
    el('.buttons', buttons),
  ];

  if (kind === 'sprite') {
    props.children.push(el('.icon-error', {
      text: "•",
    }));
  }

  this.el = item._el = el('li.' + kind, props);
};

ListEditorItem.prototype.pointerDown = function(e) {
  if (e.target === this.dragHandle) {
    this.editor.pointerDown(e, this.item);
  }
};



/* NamesEditor */

function allVariables(sprites) {
  var result = [];
  sprites.forEach(function(s) {
    result = result.concat(s.variables()).concat(s.lists());
  });
  return result;
}

function seenNames(objects) {
  var seen = {};
  objects.forEach(function(obj) {
    var name = (obj._name || obj.name)();
    seen[name] = true;
  });
  return seen;
}

var NamesEditor = function(sprite, kind) {
  var addText = sprite._isStage ? "＋ for all sprites" : "＋ for this sprite";
  this.factory = (kind === 'variable' ? Project.newVariable : Project.newList);

  this.names = sprite[kind + 's'];

  this.sprite = sprite;
  this.kind = kind;

  this.el = el('', [
    el('ul.reporters', {
      class: kind,
      children: this.names.map(function(item) {
        return new NamesEditorItem(item, this).el;
      }.bind(this)),
    }),
    el('p.new a.new-variable', {
      text: addText,
      on_click: function() {
        Oops(function() {
          var newVar = this.factory('');
          this.names.push(newVar);
          newVar._isEditing.assign(true);
        }.bind(this));
      }.bind(this),
    }),
  ]);
};

var NamesEditorItem = function(item, namesEditor) {
  this.item = item;
  this.factory = namesEditor.factory;
  this.kind = namesEditor.kind;
  this.names = namesEditor.names;
  this.sprite = namesEditor.sprite;

  this.hasErrors = ko.computed(this.computeHasErrors.bind(this));
  this.changeTimeout = null;

  this.input = el('input', {
    placeholder: "my " + namesEditor.kind,
    value: item._name,
    on_input: this.onNameChange.bind(this),
    on_focus: function() {
      item._isEditing.assign(true);
    },
    on_blur:  function() {
      item._isEditing.assign(false);
      this.onNameBlur();
    }.bind(this),
    on_keydown: this.onKeydown.bind(this),
  });

  this.el = el('li', el('p.cm-s-' + namesEditor.kind, {
    class: ko(function() { if (this.hasErrors()) return 'cm-s-error has-errors'; }.bind(this)),
    children: [
      this.input,
      el('.icon-error', {
        text: "•",
      }),
    ],
  }));

  item._flush = this.onNameBlur.bind(this);

  item._isEditing.subscribe(function(editing) {
    if (editing) { this.input.focus(); } else { this.input.blur(); }
  }.bind(this), false);
};

NamesEditorItem.prototype.computeHasErrors = function() {
  var name = this.item._name();

  var project = App.project();
  var targets = App.active()._isStage ? project.sprites().concat([project])
                                     : [project, App.active()];
  var objects = allVariables(targets);
  var index = objects.indexOf(this.item);
  if (!name || index === -1) return false;

  objects = objects.slice(0, index);
  var seen = seenNames(objects);
  var clean = Language.cleanName(this.kind, name, seen, {});

  return name !== clean;
};

NamesEditorItem.prototype.onNameChange = function(e) {
  clearTimeout(this.changeTimeout);
  this.changeTimeout = setTimeout(this.onNameBlur.bind(this), 1000);

  // mark code editor dirty
  App.active()._scriptable.scriptsEditor.varsChanged();
};

NamesEditorItem.prototype.onNameBlur = function() {
  clearTimeout(this.changeTimeout);

  // remove empty names on blur
  var name = this.input.value;
  if (!name) {
    var index = this.names().indexOf(this.item);
    if (index !== -1) {
      Oops(function() {
        this.names.remove(index);
      }.bind(this));
      return;
    }
  }

  Oops(function() {
    this.item._name.assign(name);
  }.bind(this));
};

NamesEditorItem.prototype.onKeydown = function(e) {
  if (Host.handleUndoKeys(e)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  var input = this.input;
  var names = this.names;
  var variable = this.item;
  var factory = this.factory;

  Oops(function() {

    var start = input.selectionStart,
        end = input.selectionEnd,
        prefix = input.value.slice(0, start),
        selection = input.value.slice(start, end),
        suffix = input.value.slice(end);
    switch (e.keyCode) {
      case 13: // Return
        variable._name.assign(prefix.trim());

        var index = names().indexOf(variable);
        var newVar;
        if (selection) {
          newVar = factory(suffix.trim());
          names.insert(index + 1, newVar);

          newVar = factory(selection.trim());
          names.insert(index + 1, newVar);
          newVar._isEditing.assign(true);
        } else {
          newVar = factory(suffix.trim());
          names.insert(index + 1, newVar);
          newVar._isEditing.assign(true);
        }
        break;
      case 8: // Backspace
        if (input.value) {
          return;
        }
        var index = names().indexOf(variable);
        names.remove(index);
        if (names().length) {
          var focusIndex = index > 0 ? index - 1 : 0;
          names()[focusIndex]._isEditing.assign(true);
        }
        break;
      case 46: // Delete
        if (input.value) {
          return;
        }
        var index = names().indexOf(variable);
        names.remove(index);
        if (names().length) {
          var focusIndex = Math.min(index, names().length - 1);
          names()[index]._isEditing.assign(true);
        }
        break;
      case 38: // Up
        var index = names().indexOf(variable);
        if (index - 1 >= 0) {
          names()[index - 1]._isEditing.assign(true);
        }
        break;
      case 40: // Down
        var index = names().indexOf(variable);
        if (index + 1 < names().length) {
          names()[index + 1]._isEditing.assign(true);
        }
        break;
      case 27: // Escape
        variable._isEditing.assign(false);
        break;
      default:
        return;
    }
    e.preventDefault();
  }.bind(this));
};


/* ScriptsEditor */

var extraKeys = {
  'Ctrl-Space': function(cm) {
    if (cm.somethingSelected()) {
      cm.replaceSelection(''); // TODO complete on a selection
    }
    requestHint(cm, true);
  },
  'Tab': function(cm) {
    // seek next input
    if (inputSeek(cm, +1)) return;

    // auto-indent
    if (cm.somethingSelected()) {
      cm.indentSelection('smart');
    }
  },
  'Shift-Tab': function(cm) {
    // seek prev input
    if (inputSeek(cm, -1)) return;
  },
};
extraKeys[Host.isMac ? 'Cmd-F' : 'Ctrl-F'] = 'findPersistent';

function removeUndoKeys(keyMap) {
  var keyMap = copyKeyMap(keyMap);
  delete keyMap['Cmd-Y'];
  delete keyMap['Cmd-Z'];
  delete keyMap['Shift-Cmd-Z'];
  delete keyMap['Ctrl-Y'];
  delete keyMap['Ctrl-Z'];
  delete keyMap['Shift-Ctrl-Z'];
  return keyMap;
}

var cmOptions = {
  value: "",
  mode: '',

  indentUnit: 3,
  smartIndent: true,
  tabSize: 3,
  indentWithTabs: true,

  lineWrapping: true,
  dragDrop: false,
  cursorScrollMargin: 80,

  lineNumbers: true,

  cursorHeight: 1,

  undoDepth: NaN,

  extraKeys: extraKeys,

  autoCloseBrackets: true,
  matchBrackets: "()<>[]''\"\"",
  scrollbarStyle: 'simple',
};

var ScriptsEditor = function(sprite, project) {
  this.sprite = sprite;
  this.project = project;
  this.el = el('.editor');
  this.cm = CodeMirror(this.el, cmOptions);

  var code = Compiler.generate(sprite.scripts);
  // TODO handle errors in generate()
  this.hasChangedEver = false;
  this.cm.setValue(code);
  this.needsCompile = ko(true);
  this.hasErrors = sprite._hasErrors;
  assert(ko.isObservable(sprite._hasErrors));
  this.widgets = [];

  this.cm.clearHistory();
  assert(this.cm.getHistory().done.length === 0);
  this.cmUndoSize = 0;
  this.undoing = false;

  // send options to CM, so initial highlight is correct
  this.checkDefinitions();
  this.repaint();

  this.annotate = this.cm.annotateScrollbar('error-annotation');

  // repaint when variable/list names change
  this.bindNames(sprite.variables);
  this.bindNames(sprite.lists);
  this.bindNames(project.variables);
  this.bindNames(project.lists);

  // compile after new scripts editor is opened
  // TODO this makes initial load feel slow
  App.needsCompile.assign(true);
  this.compile();
  App.needsPreview.assign(true);

  this.cm.on('change', this.onChange.bind(this));

  // vim mode
  App.settings.keyMap.subscribe(function(keyMap) {
    if (keyMap === 'default') {
      keyMap = removeUndoKeys(CodeMirror.keyMap.default);
    }
    this.cm.setOption('keyMap', keyMap);
  }.bind(this));

  this.cm.save = App.preview.bind(App, true);
  this.cmUndo = this.cm.undo.bind(this.cm);
  this.cmRedo = this.cm.redo.bind(this.cm);
  this.cm.undo = Oops.undo;
  this.cm.redo = Oops.redo;
};

ScriptsEditor.prototype.bindNames = function(names) {
  names.map(function(item) {
    item._name.subscribe(function() {
      this.debounceRepaint();
    }.bind(this), false);
  }.bind(this));
};

ScriptsEditor.prototype.fixLayout = function(offset) {
  this.cm.setSize(NaN, this.el.clientHeight);

  // make sure scrollbar has width (cm.display.barWidth)
  // otherwise annotations won't appear!
  this.cm.setOption('scrollbarStyle', 'native');
  this.cm.setOption('scrollbarStyle', cmOptions.scrollbarStyle);
};

ScriptsEditor.prototype.compile = function() {
  if (!this.needsCompile()) return this.hasErrors();

  // clear error indicators
  this.widgets.forEach(function(widget) {
    widget.clear();
  });
  this.widgets = [];

  // flush variables (in case we cmd+return inside a variable)
  var objects = this.sprite.variables().concat(this.sprite.lists());
  objects.forEach(function(obj) {
    if (obj._isEditing()) {
      obj._flush();
    }
  });

  // parse lines
  var options = this.getModeCfg();
  var iter = this.cm.doc.iter.bind(this.cm.doc);
  var lines = Compiler.parseLines(iter, options);
  var stream = lines.slice();

  // build 'em for each line with shape of "error"
  var anns = [];
  stream.forEach(function(block, index) {
    if (block.info.shape === 'error') {
      var line = index;
      anns.push({ from: Pos(line, 0), to: Pos(line + 1, 0) });
    }
  });

  try {
    var scripts = Compiler.compile(stream);
  } catch (err) {
    var line = lines.length - (stream.length - 1); // -1 because EOF
    line = Math.min(line, lines.length - 1);

    var info = lines[line].info;
    var message = info.shape === 'error' ? info.error : err.message;

    var widgetEl = el('.error-widget', message);
    var widget = this.cm.addLineWidget(line, widgetEl, {});
    this.widgets.push(widget);
    anns.push({ from: Pos(line, 0), to: Pos(line, 0) });
    this.annotate.update(anns);

    this.needsCompile.assign(false);
    this.hasErrors.assign(true);
    return true; // has errors
  }

  this.needsCompile.assign(false);
  this.hasErrors.assign(false);
  this.sprite.scripts = scripts;
  return false;
};

ScriptsEditor.prototype.makeDirty = function() {
  this.needsCompile.assign(true);
  App.needsCompile.assign(true);
  App.needsPreview.assign(true);
  if (this.hasChangedEver) App.needsSave.assign(true);
}

ScriptsEditor.prototype.getModeCfg = function() {
  var _this = this;
  function getNames(kind) {

    var project = _this.project;
    var targets = _this.sprite._isStage ? project.sprites().concat([project])
                                        : [project, App.active()];
    var objects = allVariables(targets);

    var names = _this.sprite[kind]();
    if (!_this.sprite._isStage) {
      // include global var/list names
      names = names.concat(project[kind]());
    }

    var seen = {};
    return names.filter(function(item) {
      var name = item._name();
      var index = objects.indexOf(item);
      var seen = seenNames(objects.slice(0, index));
      return name && name === Language.cleanName(kind, name, seen, {});
    });
  }

  // force re-highlight --slow!
  return {
    name: 'tosh',
    variables: getNames('variables'),
    lists: getNames('lists'),
    definitions: this.definitions,
  };
};

ScriptsEditor.prototype.repaint = function() {
  var modeCfg = this.getModeCfg();

  // force re-highlight --slow!
  this.cm.setOption('mode', modeCfg);

  clearTimeout(this.repaintTimeout);
  this.repaintTimeout = null;
};

ScriptsEditor.prototype.debounceRepaint = function() {
  this.makeDirty();
  if (this.repaintTimeout) {
    clearTimeout(this.repaintTimeout);
  }
  this.repaintTimeout = setTimeout(this.repaint.bind(this), 500);
};

ScriptsEditor.prototype.checkDefinitions = function() {
  var defineParser = new Earley.Parser(Language.defineGrammar);

  var definitions = [];
  this.cm.doc.iter(function(line) {
    var line = line.text;
    if (!Language.isDefinitionLine(line)) return;

    var tokens = Language.tokenize(line);
    var results;
    try {
      results = defineParser.parse(tokens);
    } catch (e) { return; }
    if (results.length > 1) throw "ambiguous define. count: " + results.length;
    var define = results[0].process();
    definitions.push(define);
  });

  var oldDefinitions = this.definitions;
  if (JSON.stringify(oldDefinitions) !== JSON.stringify(definitions)) {
    this.definitions = definitions;
    return true;
  }
};

ScriptsEditor.prototype.activated = function() {
  doNext(function() {
    this.fixLayout();
    this.cm.focus();
    this.cm.refresh();

    this.debounceRepaint();
  }.bind(this));
};

ScriptsEditor.prototype.focus = function() {
  this.cm.focus();
};

ScriptsEditor.prototype.undo = function() {
  this.undoing = true;
  this.cmUndo();
  this.undoing = false;
  this.cmUndoSize = this.cm.historySize().undo;

  App.active.assign(this.sprite);
};

ScriptsEditor.prototype.redo = function() {
  this.undoing = true;
  this.cmRedo();
  this.undoing = false;
  this.cmUndoSize = this.cm.historySize().undo;

  App.active.assign(this.sprite);
};

ScriptsEditor.prototype.varsChanged = function() {
  this.hasChangedEver = true;
  this.makeDirty();
};

ScriptsEditor.prototype.onChange = function(cm, change) {
  this.hasChangedEver = true;
  this.makeDirty();

  // analyse affected lines
  var lineNos = [];
  var lines = [];
  for (var i=change.from.line; i<=change.to.line; i++) {
    lineNos.push(i);
    lines.push(this.cm.getLine(i));
  }
  lines = lines.concat(change.removed);
  lines = lines.concat(change.text);
  this.linesChanged(lines);

  // clear error widget
  for (var i=0; i<this.widgets.length; i++) {
    var widget = this.widgets[i];
    if (lineNos.indexOf(widget.line.lineNo()) > -1) {
      widget.clear();
      this.widgets.splice(i, 1);
      break; // this will only remove the first one
    }
  }

  // check undo state
  if (!this.undoing) {
    // TODO. We assume that every CM history operation will emit 'change'
    var historySize = this.cm.historySize();
    // nb. historySize appears to exclude selection operations, which is good
    if (historySize.undo !== this.cmUndoSize) {
      // assume every 'change' event create at most one undo operation
      assert(historySize.undo === this.cmUndoSize + 1)
      var op = new Oops.CustomOperation(this.undo.bind(this),
                                        this.redo.bind(this));
      Oops.insert(op);
      this.cmUndoSize++;
    }
    assert(this.cmUndoSize === historySize.undo);
  }

  // trigger auto-complete!
  requestHint(this.cm);

  // clear annotations
  this.annotate.update([]);
};

ScriptsEditor.prototype.linesChanged = function(lines) {
  for (var i=0; i<lines.length; i++) {
    var line = lines[i];
    if (Language.isDefinitionLine(line)) {
      if (this.checkDefinitions()) {
        this.debounceRepaint();
      }
      return;
    }
  }
};

/*****************************************************************************/
/* completion */

function inputSeek(cm, dir) {
  // TODO fix for ellipsises
  var l = tokenizeAtCursor(cm, { splitSelection: false });
  if (!l) return false;
  if (l.selection.indexOf('\n') > -1) return false;

  var index = l.cursor + dir;
  if (dir > 0 && l.tokens[l.cursor] && l.tokens[l.cursor].text === '-') index += 1;
  for (var i = index;
       dir > 0 ? i < l.tokens.length : i >= 0;
       i += dir
  ) {
    var token = l.tokens[i];
    if (['symbol', 'lparen', 'rparen', 'langle', 'rangle',
         'lsquare', 'rsquare'].indexOf(token.kind) === -1) {
      var start = l.start.ch + measureTokens(l.tokens.slice(0, i));
      end = start + token.text.replace(/ *$/, "").length;
      var line = l.from.line;
      if (token.kind === 'number' && l.tokens[i - 1].text === '-') start--;
      if (token.kind === 'string') { start++; end--; }

      var from = { line: line, ch: start };
      var to = { line: line, ch: end };
      if (l.cursor.ch === from.ch && l.cursor.ch + l.selection.length === to.ch) {
        continue;
      }
      cm.setSelection(from, to);
      return true;
    }
  }

  c = dir > 0 ? l.end : l.start;
  if (c.ch === l.cursor.ch) return false;
  cm.setCursor(c);
  return true;
}

function tabify(text, indent) {
  var tab = '\t';
  var text = text || '';
  var indentation = '';
  for (var i=0; i<indent; i++) indentation += tab;
  var lines = text.split('\n');
  for (var j=1; j<lines.length; j++) {
    lines[j] = indentation + lines[j];
  }
  return lines.join('\n');
}

function measureTokens(tokens) {
  var length = 0;
  for (var i=0; i<tokens.length; i++) {
    length += tokens[i].text.length;
  }
  return length;
}

function tokenizeAtCursor(cm, options) {
  var selection = cm.getSelection();
  var cursor = cm.getCursor('from');
  var text = cm.doc.getLine(cursor.line);

  var indent = /^\t*/.exec(text)[0].length;
  var prefix = text.slice(indent, cursor.ch);
  var suffix = text.slice(cursor.ch);

  var isPartial = !/ $/.test(prefix);
  var hasPadding = /^[ ?]/.test(suffix);

  var tokens,
      cursorIndex;
  if (options.splitSelection) {
    var beforeTokens = Language.tokenize(prefix);
    var afterTokens = Language.tokenize(suffix);
    tokens = beforeTokens.concat(afterTokens);
    cursorIndex = beforeTokens.length;
  } else {
    var tokens = Language.tokenize(prefix + suffix);
    var size = indent;
    for (var i=0; i<tokens.length; i++) {
      size += tokens[i].text.length;
      if (size > cursor.ch) {
        break;
      }
    }
    cursorIndex = i;
  }

  var to = measureTokens(tokens.slice(0, cursorIndex));
  var from;
  if (isPartial) {
    from = measureTokens(tokens.slice(0, cursorIndex - 1));
  } else {
    from = to;
  }

  return {
    from:  { line: cursor.line, ch: indent + from },
    to:    { line: cursor.line, ch: indent + to   },
    end:   { line: cursor.line, ch: text.length   },
    start: { line: cursor.line, ch: indent        },

    selection: selection,

    state: cm.getStateAfter(cursor.line),
    cursor: cursorIndex,
    tokens: tokens,
    isPartial: isPartial,
    hasPadding: hasPadding,
  }
}

function requestHint(cm, please) {
  cm.showHint({
    hint: please ? computeHintPlease : computeHintMaybe,
    completeSingle: false,
    alignWithWord: true,
    customKeys: {
      Up:       function(_, menu) { menu.moveFocus(-1); },
      Down:     function(_, menu) { menu.moveFocus(1); },
      Home:     function(_, menu) { menu.setFocus(0);},
      End:      function(_, menu) { menu.setFocus(menu.length - 1); },
      Tab:      function(_, menu) { menu.pick(); },
      Esc:      function(_, menu) { menu.close() },
    },
  });
}

function expandCompletions(completions, g) {
  function expand(symbol) {
    // don't suggest names twice
    if (['VariableName', 'ListName', 'ReporterParam'].indexOf(symbol) > -1) return [];

    if (typeof symbol !== 'string') {
      return [[symbol]];
    }
    if (/^@/.test(symbol)) {
      return [g.rulesByName[symbol][0].symbols];
    } if (/^[md]_/.test(symbol) || /^[A-Z]/.test(symbol)) {
      return (g.rulesByName[symbol] || []).map(function(rule) {
        return rule.symbols;
      });
    }
    return [[symbol]];
  }

  var choices = [];
  completions.forEach(function(c) {
    var symbols = c.completion;
    if (!symbols.length) return;
    var first = symbols[0],
    rest = symbols.slice(1);
    var more = expand(first).map(function(symbols) {
      return {
        completion: symbols.concat(rest),
        via: c,
      };
    });
    choices = choices.concat(more);
  });
  return choices;
}

function computeHintPlease(cm) { return computeHint(cm, true); }
function computeHintMaybe(cm) {  return computeHint(cm, false); }

function computeHint(cm, please) {
  var l = tokenizeAtCursor(cm, { splitSelection: true });
  if (!l) return false;
  if (l.cursor === 0) {
    return false;
  }
  /*
  if (!(l.selection === "" || l.selection === "_" ||
        l.selection === "<>")) {
    return false;
  }*/

  var state = l.state;
  var completer = state.completer;
  var grammar = completer.leftParser.grammar;

  var tokens = l.tokens.slice();
  var cursor = l.cursor;

  var isValid;
  try {
    completer.parse(tokens); isValid = true;
  } catch (e) {
    isValid = false;
    // console.log(e); // DEBUG
  }

  var partial;
  if (l.isPartial) {
    partial = tokens[cursor - 1];
    tokens.splice(cursor - 1, 1);
    cursor--;

    // don't offer completions if we don't need to
    // eg. "stop all|" should *not* suggest "sounds"
    if (isValid && !l.selection && !please) return;
  }

  var completions = completer.complete(tokens, cursor);
  if (!completions) {
    return false; // not a list--there was an error!
  }

  if (!tokens.length) {
    // TODO move 'define' into main grammar
    ['define-atomic', 'define'].forEach(function(keyword) {
      completions.splice(0, 0, {
        start: 0,
        end: 0,
        pre: [],
        post: [],
        rule: { process: { _info: { category: 'custom' } } },
        item: null,
        completion: [{ kind: 'symbol', value: keyword }, "block"],
      });
    });
  }

  completions = completions.filter(function(c) {
    if (c.pre.length === 1 && typeof c.pre[0] === "string") return;
    if (c.pre[0] === "block") return;
    if (c.rule.process.name === 'unaryMinus') return;
    if (c.rule.process._info === undefined && c.rule.symbols[0].value === undefined) return;
    return true;
  });

  var expansions = expandCompletions(completions, grammar);
  expansions.forEach(function(x) {
    x.length = x.via.end - x.via.start;
  });

  /*
  if (expansions.length) {
    var shortest = Math.min.apply(null, expansions.map(function(x) {
      return x.completion.filter(function(symbol) { return symbol.kind !== 'symbol' }).length;
    }));
    expansions = expansions.filter(function(x) {
      var length = x.completion.filter(function(symbol) { return symbol.kind !== 'symbol' }).length;
      return length === shortest;
    });
  }
  */

  if (l.isPartial) {
    expansions = expansions.filter(function(x) {
      var first = x.completion[0];
      return (first.kind === 'symbol' && partial.kind === 'symbol' &&
              first.value && first.value.indexOf(partial.value) === 0
        ); // || (typeof first === 'string' && x.via.pre.length);
    });
  } else {
    // don't complete keys!
    expansions = expansions.filter(function(x) {
      var first = x.completion[0];
      return !(first.kind === 'symbol' && /^[a-z0-9]$/.test(first.value));
    })

    if (cursor === tokens.length) {
      expansions = expansions.filter(function(x) {
        return x.via.pre.length || x.via.post.length;
      })
    }
  }

  expansions.sort(function(a, b) {
    var aInfo = a.via.rule.process._info;
    var bInfo = b.via.rule.process._info;
	var aSelector = aInfo ? aInfo.selector : a.via.rule.name;
	var bSelector = bInfo ? bInfo.selector : b.via.rule.name;

	var aIndex = Language.preferSelectors.indexOf(aSelector);
	var bIndex = Language.preferSelectors.indexOf(bSelector);
	if (aIndex > -1 && bIndex > -1) {
	  if (aIndex !== bIndex) return aIndex - bIndex;
	} else if (aIndex > -1) {
	  return +1;
	}

	var aText = a.completion.join(" ");
	var bText = b.completion.join(" ");
	return aText < bText ? -1 : aText > bText ? +1 : 0;
  });

  var rule_categories = {
	'VariableName': 'variable',
	'ListName': 'list',
  };

  var list = [];
  expansions.forEach(function(x) {
    var symbols = x.completion.slice();
    var c = x.via;

    assert(symbols.length);

    var selection;
    var text = "";
    var displayText = "";
    for (var i=0; i<symbols.length; i++) {
      var part = symbols[i];
      var displayPart = undefined;

      if (i > 0 && part.value !== "?") {
        displayText += " ";
        text += " ";
      }

      if (typeof part === "string") {
        var name = symbols[i];
        if (name[0] === "@") {
          part = grammar.rulesByName[name][0].symbols[0].value;
        } else {
          if (/^b[0-9]?$/.test(name)) {
            part = "<>";
          } else {
            part = "_";
          }

          if (partial && i === 0) {
            displayPart = part;
            part = partial.value;
            if (!selection) selection = { ch: text.length + part.length, size: 0 };
          } else {
            if (!selection) selection = { ch: text.length, size: part.length };
          }

          /*
          if (l.isPartial && i === 0) {
            // Sometimes we need more than one token!
            // Not sure what to do about this…

            var token = l.tokens[l.cursor - 1];
            displayPart = part;
            part = token.text;
            selection = { ch: part.length };
          }
          */
        }
      } else if (part && part.kind === "symbol") {
        part = part.value;
      } else {
          return;
      }
      text += part;
      displayText += (displayPart === undefined ? part : displayPart);
    }

    if (displayText === "<>" || displayText === "_") return;

    assert(text);

    var indent = state.indent;
    if (text === "else" && indent.slice().pop() !== 'if') return;
    if (text === "end" && !indent.length) return;

    // no space before trailing `?`
    text = text.replace(/ \?$/, "?");

    // add padding, but only very rarely
    if (!l.hasPadding && !isValid && partial && partial.text === text) {
      text += " ";
    }

    var info = {};
    if (c.rule.process._info) {
      info = c.rule.process._info;
    } else {
      c.item.predictedBy.forEach(function(item) {
        info = item.rule.process._info || {};
      });
    }

    // add "end" after c-blocks
    switch (info.shape) {
      case 'c-block':
      case 'c-block cap':
      case 'if-block':
        var after = "\nend";
        if (!selection) { // no inputs
          // put cursor at EOL
          selection = { ch: text.length, size: 0 };
        }
        text += tabify(after, indent.length);
        break;
    }

    var completion = {
      displayText: displayText,
      text: text,
      hint: applyHint,
      selection: selection,
      category: info.category || rule_categories[c.rule.name],
      render: renderHint,
      _name: c.rule.name, // DEBUG
    };

    function renderHint(parentNode, self, data) {
      var className = '';
      if (data.category) className = '.cm-s-' + data.category;
      parentNode.appendChild(el(className, data.displayText));
    }

    /*
    if (l.isPartial) {
      completion.text += " ";

      if (text === "_") {
        completion.selection = undefined;
      }

      if (!completion.selection) {
        completion.seekInput = true;
      }

      var nextToken = l.tokens[l.cursor];
      if (nextToken && /^ /.test(nextToken.text)) {
        completion.to = { line: l.to.line, ch: l.to.ch + 1 };
      }
    }
    */

    list.push(completion);
  });

  var result = {
    list: list,
    from: l.from,
    to:   l.to,
  };

  function applyHint(cm, data, completion) {
    var text = completion.text;
    cm.replaceRange(text, completion.from || data.from,
                          completion.to || data.to, "complete");
    if (completion.selection) {
      var line = result.from.line;
      var start = result.from.ch + completion.selection.ch;
      var end = start + (completion.selection.size || 0);
      cm.setSelection({ line: line, ch: start }, { line: line, ch: end });
    }
    cm.indentLine(l.start.line);
  }

  return result;
};

/*****************************************************************************/

var Settings = function(defaults) {
  this.key = 'toshSettings';
  this.settings = {};
  this._autoSave = false;
  this.update(defaults);
  this.update(this.load());
  this._autoSave = true;
};

Settings.prototype.get = function(name, defaultValue) {
  if (!this.settings.hasOwnProperty(name)) {
    var observable = ko(defaultValue);
    // nb. Careful not to save while loading defaults!
    observable.subscribe(this.save.bind(this), this._autoSave);
    this.settings[name] = observable;
  }
  this[name] = this.settings[name];
  return this.settings[name];
};

Settings.prototype.save = function() {
  var data = Project.copyForSave(this.settings);
  window.localStorage[this.key] = JSON.stringify(data);
};

Settings.prototype.load = function() {
  var encoded = window.localStorage[this.key] || "";
  if (!encoded) return;
  try {
    var data = JSON.parse(encoded);
  } catch(e) {
    console.log("Couldn't parse settings", e);
    return;
  }
  if (!data) return;
  if (typeof data !== 'object') return;
  return data;
};

Settings.prototype.update = function(data) {
  data = data || {};
  Object.keys(data).forEach(function(name) {
    var value = data[name];
    this.get(name, value).assign(value);
  }, this);
};


var Container = function(project, active) {
  active.assign(project.sprites()[0] || project);

  this.project = project;
  this.active = active;

  this.activeScriptable = ko();
  this.onSwitchSprite = this.switchSprite.bind(this);
  this.active.subscribe(this.onSwitchSprite);

  this.el = el('.container', [
    el('.switcher', new ListEditor(project, 'sprite', active).el),
    el('.active', this.activeScriptable.compute(function(scriptable) {
      return scriptable ? scriptable.el : "";
    })),
  ]);

  // refresh stage when adding/removing sprites
  project.sprites.subscribe(function() {
    doNext(function() {
      App.preview(false);
    });
  }, false);
};

Container.prototype.switchSprite = function(s) {
  assert(this.project === App.project());

  var scriptable = s._scriptable = s._scriptable
                                || new Scriptable(s, this.project);

  if (this.activeScriptable()) this.activeScriptable().deactivated();
  this.activeScriptable.assign(scriptable);
  scriptable.activated();
};

Container.prototype.destroy = function() {
  this.active.unsubscribe(this.onSwitchSprite);
};


var App = new (function() {

  this.tab = ko('data');

  this.project = ko(Project.new());
  this.active = ko();
  this.isBlank = ko(true);

  this.needsSave = ko(false);
  this.needsCompile = ko(false);
  this.hasErrors = ko(false);

  this.stage = null;
  this.needsPreview = ko(false);

  this.settings = new Settings({
    smallStage: false,
    keyMap: 'default',
    enableContextMenu: false,
  });
  this.smallStage = this.settings.smallStage;
  this.isFullScreen = ko(false);

})();

App.onOops = function() {
  App.needsSave.assign(true);
  App.needsPreview.assign(true);
};

// initial project load should not push onto undo stack

App.project.subscribe(function(project) {
  App.isBlank.assign(false);
}, false);

App.loadProject = function(project) {
  if (App.isBlank() && !Oops.canUndo()) {
    // blank project, so don't push onto undo stack
    App.project.assign(project);
    // clear redo stack
    Oops.reset();
  } else {
    Oops(function() {
      App.project.assign(project);
    });
  }
};

App.save = function() {
  // refresh CM editors
  if (App.compile()) return; // TODO alert compile error

  // make project format
  var zip = Project.save(App.project());

  // no longer dirty!
  App.needsSave.assign(false);
  return zip;
};

/* compile each ScriptsEditor */
App.compile = function() {
  var project = App.project();
  var scriptables = [project].concat(project.sprites());
  var hasErrors = false;
  scriptables.forEach(function(s) {
    if (s._scriptable) {
      hasErrors = hasErrors || s._scriptable.scriptsEditor.compile();
    }
  });
  App.needsCompile.assign(false); // no longer dirty

  if (hasErrors) {
    App.hasErrors.assign(true);
    return true;
  }

  // sync phosphorus data
  App.hasErrors.assign(false);
  App.sync();
  return false;
};

/* copy data back from phosphorus */
App.sync = function() {
  var phosphorus = App.stage;
  if (!phosphorus) return;

  [phosphorus].concat(phosphorus.children).forEach(function(s) {
    if (s.isStage || s.isSprite) {
      if (s.isClone) return;

      var t = s._tosh;

      // variables could be created after we last sent the project to
      // phosphorus, so we have fallback values
      t.variables().forEach(function(variable) {
        var name = variable._name();
        variable.value = s.vars[name] || 0;
      });
      t.lists().forEach(function(list) {
        var name = list._name();
        list.contents = s.lists[name] || [];
      });
      t.currentCostumeIndex.assign(s.currentCostumeIndex);

      if (s.isStage) {
        t.tempoBPM = s.tempoBPM;
      } else {
        t.scratchX = s.scratchX;
        t.scratchY = s.scratchY;
        t.direction = s.direction;
        t.rotationStyle = s.rotationStyle;
        t.visible = s.visible;
      }

    } else if (s.target) {
      // Watcher
    }
  });
};

/* send project to phosphorus */
App.preview = function(start) {
  // refresh CM editors
  if (App.compile()) return;

  if (App.stage) {
    App.stage.pause();
    App.stage.stopAll();
    window.oldStages = (window.oldStages || []).concat([App.stage]); // DEBUG
    App.stage = null;
  }

  // make project format
  var project = App.project();
  var zip = Project.save(project);

  // send phosphorus the zip object
  var request = P.IO.loadSB2Project(zip);
  if (request.isError) {
    console.error(request.result);
    return;
  }

  // save list of children, in case it changes _while the project is loading_
  var children = project.children().slice();

  player.loadProject(request, function(stage) {
    App.stage = stage;
    stage.handleError = function(e) {
      console.error(e.stack || e);
    };

    stage._tosh = project;
    assert(stage._tosh);

    // sync() needs references to original scriptable
    // phosphorus doesn't support list watchers
    children = children.filter(function(obj) { return !!obj.objName; })
    assert(stage.children.length === children.length);
    for (var i=0; i<stage.children.length; i++) {
      var s = stage.children[i];
      if (s.isSprite) {
        s._tosh = children[i];
      }
    }

    if (start) {
      stage.focus();
      stage.triggerGreenFlag();
    }
  });

  // no longer dirty
  App.needsPreview.assign(false);
};

/* preview when green flag clicked, if needed */
App.preFlagClick = function() {
  if (App.needsPreview()) {
    App.preview(true);
    return true; // tell phosphorus not to start project
  }
};

App.runProject = function() {
  player.flagClick({ shiftKey: false, preventDefault: function(){} });
};

/* drop media files on window */
App.filesDropped = function(files) {
  [].slice.apply(files).forEach(App.fileDropped);
};

App.fileDropped = function(f) {
  var parts = f.name.split('.');
  var ext = parts.pop().toLowerCase();
  var fileName = parts.join('.');
  if (ext === 'png' || ext === 'jpg' || ext == 'jpeg' || ext === 'svg') {
    if (ext === 'jpeg') ext = 'jpg';
    var reader = new FileReader;
    reader.onloadend = function() {
      var ab = reader.result;
      // import dropped costume

      var costume = Project.newCostume(fileName, ext, ab);
      // TODO resize bitmaps to be less than 480x360

      // ensure unique name
      costume.name.assign(uniqueName(costume.name(), App.active().costumes()));

      Oops(function() {
        App.active().costumes.push(costume);
      });
      App.tab.assign('costumes');
    };
    reader.readAsArrayBuffer(f);
  }
  // TODO sounds
};


// build scriptable pane when switching sprites

var wrap = document.querySelector('#wrap');
var container = null;
App.project.subscribe(function(project) {
  if (container) {
    wrap.removeChild(container.el);
    container.destroy();
  }
  container = new Container(project, App.active); // will assign App.active
  if (Host.isApp) wrap.appendChild(container.el);
});


// preview project (but stopped!) when first loaded

var player = Player();
App.project.subscribe(function(project) {
  App.preview(false);
});


// resize CM when its container changes size

function fixActiveScriptsEditor() {
  // if window is resized while fullscreen, CM gets upset
  if (App.isFullScreen()) return;
  App.active()._scriptable.scriptsEditor.fixLayout();
}
windowSize.subscribe(fixActiveScriptsEditor);
App.isFullScreen.subscribe(fixActiveScriptsEditor);

/*****************************************************************************/

Host.onAppLoad();

