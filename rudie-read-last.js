(function() {

	// You can paste this version into the console
	// if ( !window.rudieLastReadConfig ) return;

	var cfg = window.rudieLastReadConfig;

	/**/
	cfg = {
		name: 'myyoutube',

		// OPTIONAL //
		active: function() {
			return !!document.querySelector(this.listSelector);
		},
		redundancy: 4,

		headerSelector: '.feed-header',
		appendButtonBefore: true, // true = first, false = last (default), <selector> = before that

		listSelector: '.individual-feed[data-feed-name="subscriptions"] #browse-items-primary',
		itemSelector: '.feed-item-container',
		idItemSelector: '[data-context-item-id]', // OPTIONAL, use itemSelector by default //
		idAttribute: 'data-context-item-id',

		// OPTIONAL //
		menuSelector: '.yt-uix-button-menu',
		menuHTML: '<ul><li class="rudies-menu-item" role="menuitem"><span class="yt-uix-button-menu-item">Mark this & older as READ</span></li></ul>',
	};
	/**/

	_init();

	function _init() {
console.debug('_init');
		if ( !cfg.active() ) return;

		_mark();
		_button();
		_listen();
	}

	function _ancestor(el, sel) {
		while ( el.parentNode && el != document.documentElement ) {
			el = el.parentNode;
			if ( el.matches(sel) ) {
				return el;
			}
		}
	}

	function _ajax(url, method, callback, data) {
		var xhr = new XMLHttpRequest;
		xhr.open(method, url, true);
		xhr.onload = function(e) {
			var rsp = this.responseText;
			try { rsp = JSON.parse(rsp); } catch (ex) {}
			callback.call(this, rsp, e);
		};
		data && xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		xhr.send(data);
	}

	function _get() {
console.debug('_get');
		_ajax('//webblocks.nl/object-store.php?get=' + cfg.name + '.lastread', 'get', function(rsp, e) {
			if ( rsp.error || !rsp.exists ) {
				return;
			}

			var selector = rsp.value.map(function(id) {
				return cfg.idItemSelector + '[' + cfg.idAttribute + '="' + id + '"]';
			}).join(', ');
			var items = document.querySelectorAll(selector);
			[].forEach.call(items, function(item) {
				_ancestor(item, cfg.itemSelector).classList.add('rudie-read-it');
			});
		});
	}

	function _mark() {
console.debug('_mark');
		_get();
		_menu();
	}

	function _menu() {
console.debug('_menu');
		var selector = cfg.itemSelector + ' ' + cfg.menuSelector;
		var menus = document.querySelectorAll(selector);
		[].forEach.call(menus, function(menu) {
			if ( menu.classList.contains('rudie-added-menu-items') ) return;
			menu.classList.add('rudie-added-menu-items');

			var frag = document.createElement('div');
			frag.innerHTML = cfg.menuHTML;
			var menuItem = frag.querySelector('.rudies-menu-item');
			menuItem.onclick = function(e) {
				e.preventDefault();
				var item = _ancestor(this, cfg.itemSelector);
				_save(item);
			};
			menu.appendChild(menuItem);
		});
	}

	function _save(lastReadItem) {
console.debug('_save');
		var items = [].slice.call(document.querySelectorAll(cfg.itemSelector));
		lastReadItem || (lastReadItem = items[0]);

		[].forEach.call(document.querySelectorAll('.rudie-read-it'), function(el) {
			el.classList.remove('rudie-read-it');
		});

		var thisIndex = items.indexOf(lastReadItem);
		var readItems = items.slice(thisIndex, thisIndex + cfg.redundancy);
		var lastRead = readItems.map(function(item) {
			item.classList.add('rudie-read-it');
			return item.querySelector(cfg.idItemSelector).getAttribute(cfg.idAttribute);
		});

		_ajax('//webblocks.nl/object-store.php', 'post', function(rsp, e) {
			console.log('SAVED LAST READ', rsp);
		}, 'put=' + cfg.name + '.lastread&value=' + encodeURIComponent(JSON.stringify(lastRead)));
	}

	function _button() {
console.debug('_button');
		var header = document.querySelector(cfg.headerSelector);
		var button = document.createElement('button');
		button.textContent = 'Mark all READ';
		button.className = 'rudie-read-it-button';
		button.onclick = function() {
			_save();
		};

		if ( cfg.appendButtonBefore === true ) {
			header.insertBefore(button, header.firstElementChild);
		}
		else if ( typeof cfg.appendButtonBefore == 'string' ) {
			header.insertBefore(button, header.querySelector(cfg.appendButtonBefore));
		}
		else {
			header.appendChild(button);
		}
	}

	function _listen() {
console.debug('_listen');
		var list = document.querySelector(cfg.listSelector);
		var mo = new MutationObserver(function(muts) {
			if ( muts[0].addedNodes[0].matches(cfg.itemSelector) ) {
				setTimeout(_mark, 100);
			}
		});
		mo.observe(list, {childList: true});
	}

})();
