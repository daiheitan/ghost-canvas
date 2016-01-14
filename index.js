if ( typeof module !== 'undefined' && module.exports ) module.exports = function() {
  // register document on web worker
  var inWorker = self.document === undefined
  if (!self.document) self.document = {
    createElement: function(tagName) {
      if (tagName === 'canvas') return new GhostCanvas();
      else if (tagName === 'image') return new GhostImage();
    }
  };

  // event handlers
  var handlers = {}, globalCounter = 0;
  self.on = function(tag, eventName, cb) {
    if (!handlers[tag]) handlers[tag] = {};
    if (!handlers[tag][eventName]) handlers[tag][eventName] = [];
    handlers[tag][eventName].push(cb);
  };

  function GhostImage() {
    var _src = null, that = this, _onload = null;
    this._id = globalCounter++;
    this._crossOrigin = null;
    this._tag = 'img'
    Object.defineProperty(this, 'crossOrigin', {
      get: function() { return _crossOrigin; },
      set: function(value) {
        _crossOrigin = value
        self.postMessage({ type: 'set', id: that._id, tag: 'img', key: 'crossOrigin', value: _src });
      }
    });
    Object.defineProperty(this, 'src', {
      get: function() { return _src; },
      set: function(value) {
        _src = value;
        self.postMessage({ type: 'set', id: that._id, tag: 'img', key: 'src', value: _src });
      }
    });
    Object.defineProperty(this, 'onload', {
      get: function() { return _onload; },
      set: function(cb) {
        if (_onload) self.off('imageonload', _onload);
        self.on('imageonload', cb);
        _onload = cb;
      }
    });
    self.register(this._tag, 'onload', _onload);
  }

  function GhostImageData() {
    this.width = 0;
    this.height = 0;
    this.data = [];
    this._id = globalCounter++;
  }

  function GhostCanvasFill() {
    this._id = globalCounter++;
  }

  function GhostCanvas() {
    this.width = 0;
    this.height = 0;
    this.id = null;
  }

  GhostCanvas.prototype.getContext = function(key) {
    if (key === '2d') {
      if (!this.context) this.context = new GhostCanvasContext(this);
      return this.context;
    } else throw new Error('Only 2d context is supported');
  }

  GhostCanvas.prototype.caller = function(fnName, arguments) {
    if (inWorker) {
      var attrs = {}
      for (var key in this) {
        if (this.hasOwnProperty(key) && key[0] !== '_' && key !== 'canvas') {
          if (this._lastTimeProps[key] !== this[key]) {
            attrs[key] = (this[key] instanceof GhostCanvasFill ? { id: this[key].id } : this[key]);
            this._lastTimeProps = attrs[key];
          }
        }
      }
      self.postMessage({ type: 'call', method: fnName, args: arguments, from: this.id, tag: 'canvas', attrs: attrs });
    }
  }

  function GhostCanvasContext(ghostCanvas) {
    this._state = [];
    this._matrix = [ 1, 0, 0, 1, 0, 0 ]; // 11, 12, 21, 22, 31, 32
    this._lineDash = [];
    this._lastTimeProps = {};
    // props
    this.canvas = ghostCanvas;
    this.direction = 'inherit';
    this.fillStyle = '#000';
    this.font = '10px sans-serif';
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = null;
    this.lineCap = 'butt';
    this.lineDashOffset = null;
    this.lineJoin = 'miter';
    this.lineWidth = 1.0;
    this.miterLimit = 10;
    this.shadowBlur = 0;
    this.shadowColor = 'black';
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.strokeStyle = '#000';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
  }


  // methods type 1
  ['arc', 'arcTo', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath', 'fill', 'fillRect', 'fillText', 'lineTo', 'moveTo', 'quadraticCurveTo', 'rect', 'stroke', 'strokeRect', 'strokeText'].forEach(function(key) {
    GhostCanvasContext.prototype[key] = function() {
      this.canvas.caller(key, arguments)
    }
  });

  GhostCanvasContext.prototype.rotate = function(rad) {
    var c = Math.cos(rad);
    var s = Math.sin(rad);
    var m11 = this._matrix[0] * c + this._matrix[2] * s;
    var m12 = this._matrix[1] * c + this._matrix[3] * s;
    var m21 = this._matrix[0] * -s + this._matrix[2] * c;
    var m22 = this._matrix[1] * -s + this._matrix[3] * c;
    this._matrix[0] = m11;
    this._matrix[1] = m12;
    this._matrix[2] = m21;
    this._matrix[3] = m22;
    this.canvas.caller('rotate', [rad]);
  };

  GhostCanvasContext.prototype.scale = function(sx, sy) {
    this._matrix[0] *= sx;
    this._matrix[1] *= sx;
    this._matrix[2] *= sy;
    this._matrix[3] *= sy;
    this.canvas.caller('scale', [sx, sy]);
  };

  GhostCanvasContext.prototype.translate = function(x, y) {
    this._matrix[4] += this._matrix[0] * x + this._matrix[2] * y;
    this._matrix[5] += this._matrix[1] * x + this._matrix[3] * y;
    this.canvas.caller('translate', [x, y]);
  };

  GhostCanvasContext.prototype.transform = function(a, b, c, d, e, f) {
    var matrix = [a, b, c, d, e, f]
    var m11 = this._matrix[0] * matrix[0] + this._matrix[2] * matrix[1];
    var m12 = this._matrix[1] * matrix[0] + this._matrix[3] * matrix[1];

    var m21 = this._matrix[0] * matrix[2] + this._matrix[2] * matrix[3];
    var m22 = this._matrix[1] * matrix[2] + this._matrix[3] * matrix[3];

    var dx = this._matrix[0] * matrix[4] + this._matrix[2] * matrix[5] + this._matrix[4];
    var dy = this._matrix[1] * matrix[4] + this._matrix[3] * matrix[5] + this._matrix[5];

    this._matrix[0] = m11;
    this._matrix[1] = m12;
    this._matrix[2] = m21;
    this._matrix[3] = m22;
    this._matrix[4] = dx;
    this._matrix[5] = dy;
    this.canvas.caller('transform', arguments);
  };

  GhostCanvasContext.prototype.setTransform = function(a, b, c, d, e, f) {
    this._matrix = [a, b, c, d, e, f];
    this.canvas.caller('setTransform', arguments);
  };

  GhostCanvasContext.prototype.drawImage = function(image) {
    // image should be a GhostImage instance
    this.canvas.caller('drawImage', [image._id].concat(Array.prototype.slice.call(arguments, 1)));
  };

  GhostCanvasContext.prototype.setLineDash = function(segments) {
    this._lineDash = segments;
    this.canvas.caller('setLineDash', arguments);
  };

  GhostCanvasContext.prototype.getLineDash = function() {
    return this._lineDash;
  };

  GhostCanvasContext.prototype.createImageData = function(width, height) {
    var result = new GhostImageData();
    if (width instanceof GhostImageData) {
      result.width = width.width;
      result.height = width.height;
    } else {
      result.width = width;
      result.height = height;
    }
    this.canvas.caller('createImageData', { args: arguments, id: result._id });
    return result;
  };

  GhostCanvasContext.prototype.putImageData = function(imageData) {
    this.canvas.caller('putImageData', { args: arguments, id: imageData._id });
  };

  GhostCanvasContext.prototype.getImageData = function(sx, sy, sw, sh) {
    var result = new GhostImageData();
    result.width = sw;
    result.height = sh;
    this.canvas.caller('getImageData', { args: arguments, id: result._id });
    return result;
  };

  GhostCanvasContext.prototype.createPattern = function(image, rep) {
    var result = new GhostCanvasFill();
    var args = [];
    if (image._id) args.push({ id: image._id });
    else args.push(image);
    args.push(rep);
    this.canvas.caller('createPattern', { args: arguments, id: result._id });
    return result;
  };

  ['createLinearGradient', 'createRadialGradient'].forEach(function(key) {
    var result = new GhostCanvasFill();
    this.canvas.caller(key, { args: arguments, id: result._id });
    return result;
  });

  GhostCanvasContext.prototype.save = function() {
    var tmp = {};
    for (var key in this) {
      if (key[0] !== '_' && this.hasOwnProperty(key)) {
        tmp[key] = this[key];
      }
    }
    tmp._matrix = this._matrix;
    tmp._lineDash = this._lineDash;
    this._state.push(tmp);
  };

  GhostCanvasContext.prototype.restore = function() {
    var tmp = this._state.pop();
    if (tmp) {
      for (var key in tmp) this[key] = tmp[key];
    }
  };

  ['drawFocusIfNeeded', 'measureText', 'isPointInPath', 'isPointInStroke'].forEach(function(key) {
    console.warn('The method', key, 'is not supported.');
  });
}
