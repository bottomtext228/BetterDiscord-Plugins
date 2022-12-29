/**
 * @name OCS
 * @version 2.1.0
 * @description Orpheus Containment System.
 * @author bottom_text | Z-Team
*/


module.exports = class OCS {
	constructor(meta) {
		for (let key in meta) {
			this[key] = meta[key];
		}
	}
	start() {

		const libraries = [
			{
				name: 'ZeresPluginLibrary',
				url: 'https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js',
				filename: '0PluginLibrary.plugin.js'
			}
		];
		if (!this.checkLibraries(libraries)) {
			return;
		}

		this.findWebPacks();



		this.members = [];
		this.fs = require('fs');
		this.path = require('path');
		this.configPath = this.getConfigPath();
		this.containedObjects = this.loadSettings();
		this.labels = this.setLabelsByLanguage();

		console.log(`${this.name}: started!`);


		/* 90% of the code is old and pretty bad (settings menu). I won't rewrite it. :trolling: */

		BdApi.Patcher.before(
			this.name,
			this.DispatchWebPack,
			'dispatch',
			(_, args) => this.onDispatchEvent(args)
		);
		// хукаем обработчик основных событий, включая сообщения.
		// before, чтобы не конфликтовало с другими плагинами, хукающими dispatch, так как нам надо только считывать данные 

		BdApi.Patcher.instead(
			this.name,
			this.ComponentDispatchWebpack, // ...
			'dispatch',
			(_, args, original) => this.onComponentDispatchDispatchEvent(args, original)
		); // хук для отключения тряски приложения


	}

	onDispatchEvent(args) { // обработчик событий 
		const dispatch = args[0];
		if (!dispatch)
			return;
		if (dispatch.type == 'MESSAGE_CREATE') {

			const isLocalUser = dispatch.message.author.id == this.getCurrentUser().id;
			const currentObject = this.containedObjects.find(object => {
				if (object.id == dispatch.message.author.id) {
					if (isLocalUser) {
						if (dispatch.optimistic) { // избегаем спама при работе на локального пользователя
							return false;
						}
					}
					return true;
				}
			})
			if (currentObject) {

				if (currentObject.method == 'reactions') {
					currentObject.reactions.forEach(reaction => {
						this.sendReaction(dispatch.message.channel_id, dispatch.message.id, reaction);
					});
				} else if (currentObject.method == 'message') {
					var message = '';
					currentObject.reactions.forEach(reaction => {
						message += this.prepareEmojiToSend(reaction, true);
					});
					if (!isLocalUser || message != dispatch.message.content) { // избегаем "рекурсии" при работе на локального пользователя
						this.sendMessage(dispatch.message.channel_id, message);
					}
				}

			}


		}

	}

	getSettingsPanel() {

		const menuHTML =
			`<div id="main">

			<button type="button" id="add_button" style="width:565px"
				class="button-f2h6uQ lookFilled-yCfaCM colorBrand-I6CyqQ sizeSmall-wU2dO- grow-2sR_-F">
				<div class="contents-3ca1mk">${this.labels.add_button}</div>
			</button>
			
			<pre>&nbsp</pre>

			<div id="containedObjects"> 
			</div>
			
		</div>`


		const html = ZeresPluginLibrary.DOMTools.createElement(menuHTML);

		const buttons = Array.from(html.querySelectorAll('button'));
		buttons.find(button => button.id == 'add_button').addEventListener('click', () => {

			const elements = [];

			const userToAdd = this.parseHTML(`<div id="usertoadd"></div>`);
			const input_id = this.parseHTML(
				`<div class="container-2oNtJn medium-2NClDM">
					<div class="inner-2pOSmK">
						<input type="text" class="input-2m5SfJ" name="message" placeholder="${this.labels.input_id}" id='input_id' />
					</div>
				</div>`
			);
			const input_name = this.parseHTML(
				`<div class="container-2oNtJn medium-2NClDM">			
					<div class="inner-2pOSmK">
						<input type="text" class="input-2m5SfJ" name="message" placeholder="${this.labels.input_name}" id='input_name' />
					</div>
				</div>`
			);

			input_id.addEventListener('input', () => {
				const userIdToFind = document.getElementById('input_id').value.trim();
				if (userIdToFind == '')
					return;
				const user = this.getUser(userIdToFind)
				this.renderUserToAdd(user);
			});
			const membersTable = this.parseHTML(`<table id="findObjects"></table>`);
			input_name.addEventListener('input', () => {

				const usernameToFind = document.getElementById('input_name').value.trim();

				if (usernameToFind == '')
					return;
				membersTable.innerHTML = '';
				for (var membersIterator = 0; membersIterator < this.members.length; membersIterator++) {
					const member = this.members[membersIterator];

					if (member.username.toLowerCase().search(usernameToFind.toLowerCase()) != -1) {
						this.renderUserToAdd(member);
					}
				}

			});
			const padding = this.parseHTML(`<pre>&nbsp</pre>`);

			elements.push(userToAdd);
			elements.push(input_id);
			elements.push(padding);
			elements.push(input_name);
			elements.push(membersTable);

			ZeresPluginLibrary.Modals.showModal(this.labels.add_object, ZeresPluginLibrary.ReactTools.createWrappedElement(elements), {
				confirmText: 'OK',
				size: ZeresPluginLibrary.Modals.ModalSizes.SMALL,
				red: false
			});

		});

		// так как конфиг работает на костылях и 1 элемент в нём всегда пустой
		for (var objectIterator = 1; objectIterator < this.containedObjects.length; objectIterator++) {
			this.renderContainedObject(objectIterator, html)
		}


		for (const guildId in this.getGuilds()) { // get all users. We can do it by get all users of all guilds we are in 
			const members = this.getMembers(guildId);

			for (var membersIterator = 0; membersIterator < members.length; membersIterator++) {
				const member = this.getUser(members[membersIterator].userId)
				var wasAdded = false; // some members can be founded in different guilds for obvious reason
				for (var membersIterator = 0; membersIterator < this.members.length; membersIterator++) {
					const currentMember = this.members[membersIterator];
					if (member.username.toLowerCase() == currentMember.username.toLowerCase()) {
						wasAdded = true;
						break;
					}
				}
				if (!wasAdded) {
					this.members.push(member);
				}

			}
		}


		const input_find = this.parseHTML(`<input type="text" class="input-2m5SfJ" name="message" placeholder="${this.labels.input_find}" id='input_find'/>`);

		const membersTable = document.createElement('table');
		membersTable.id = 'members';
		input_find.addEventListener('input', () => {
			const usernameToFind = document.getElementById('input_find').value.trim();
			if (usernameToFind != '') {
				membersTable.innerHTML = '';
				for (var membersIterator = 0; membersIterator < this.members.length; membersIterator++) {
					const member = this.members[membersIterator];
					if (member.username.toLowerCase().search(usernameToFind.toLowerCase()) != -1) {
						const row = document.createElement('tr');
						row.innerHTML =
							`<td coldspan ='2'>${member.username}</td>`

						membersTable.append(row);
					}
				}
			} else {
				membersTable.innerHTML = '';
			}
		});

		return html;
	}

	saveSettings() {
		this.fs.writeFileSync(this.configPath, JSON.stringify(this.containedObjects));
	}
	getConfigPath() {
		return this.path.join(BdApi.Plugins.folder, `${this.name}.config.json`);
	}

	findWebPacks() {

		/* зачем все эти приколы с эмодзи помещать в разные модули??? */
		this.ReactionUtilities = ZeresPluginLibrary.WebpackModules.getByProps('rU', 'wX'); // ...
		this.EmojiUtilitiesWebpack = ZeresPluginLibrary.WebpackModules.getByProps('getURL');
		this.GuildUtilities = ZeresPluginLibrary.WebpackModules.getByProps('getGuildEmoji');
		this.GetByNameEmojieWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getByName');

		this.ComponentDispatchWebpack = ZeresPluginLibrary.WebpackModules.getByProps('S', 'b').S // ...
		this.DispatchWebPack = ZeresPluginLibrary.WebpackModules.find(e => e.dispatch && !e.getCurrentUser);
		this.GetUserWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getUser');
		this.GetCurrentUserWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getCurrentUser');
		this.GetGuildWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getGuild');
		this.GetMembersWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getMembers');
		this.MessageQueueWebPack = ZeresPluginLibrary.WebpackModules.getByProps('enqueue');

	}

	sendMessage(channelId, content) {
		this.MessageQueueWebPack.enqueue({
			type: 0,
			message: {
				channelId: channelId,
				content: content,
			}
		}, r => {
			return
		});
	}

	getMembers(guildId) {
		return this.GetMembersWebPack.getMembers(guildId);
	}

	getGuild(guildId) {
		return this.GetGuildWebPack.getGuild(guildId);
	}

	getGuilds() {
		return this.GuildUtilities.getGuilds();
	}

	getCurrentUser() {
		return this.GetCurrentUserWebPack.getCurrentUser();
	}

	getUser(id) {
		return this.GetUserWebPack.getUser(id);
	}

	getEmojiUrl(emojiSurrogate) { // example: '🐖' -> '/assets/d083412544c302d290775006877f6202.svg'
		return this.EmojiUtilitiesWebpack.getURL(emojiSurrogate)
	}

	onComponentDispatchDispatchEvent(args, callDefault) {
		const event = args[0];
		if (event != 'SHAKE_APP') { // убираем тряску экрана
			callDefault(...args);
		}
	}

	sendReaction(channelId, messageId, emojiName) {
		const emoji = this.prepareEmojiToSend(emojiName);
		this.ReactionUtilities.rU(channelId, messageId, emoji, undefined, { burst: false })
	}

	prepareEmojiToSend(emojiName, toString = false) { // tostring - bool. false - return object for addReaction, true - return string for message
		const emoji = this.GetByNameEmojieWebPack.getByName(emojiName);
		if (emoji) {
			return toString ? emoji.surrogates : {
				id: emoji.id == undefined ? null : emoji.id,
				name: emoji.surrogates,
				animated: emoji.animated,
			}
		} else {
			const customEmoji = this.getCustomEmoji(emojiName);
			if (customEmoji) {
				return toString ? `<:${customEmoji.name}:${customEmoji.id}>` : {
					id: customEmoji.id == undefined ? null : customEmoji.id,
					name: customEmoji.name,
					animated: customEmoji.animated,
				}
			}
		}
		return '';
	}

	getCustomEmoji(customEmojiName) {
		for (const guildId in this.getGuilds()) {
			const guildEmojiArray = this.GuildUtilities.getGuildEmoji(guildId); // получаем массив со всеми объектами кастомных эмодзи
			const customEmoji = guildEmojiArray.find(guildEmoji => guildEmoji.name == customEmojiName); // находим нужный
			if (customEmoji) {
				return customEmoji;
			}
		}
	}


	createButton(label, callback, id) {
		const ret = this.parseHTML(`<button type="button" class="button-f2h6uQ lookFilled-yCfaCM colorBrand-I6CyqQ sizeSmall-wU2dO- grow-2sR_-F" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
		if (callback) {
			ret.addEventListener('click', callback);
		}
		return ret;
	}
	parseHTML(html) {
		// TODO: drop this func, it's 75% slower than just making the elements manually
		var template = document.createElement('template');
		html = html.trim(); // Never return a text node of whitespace as the result
		template.innerHTML = html;
		return template.content.firstChild;
	}
	renderContainedObject(objectIterator, html) {

		const popoutHTML =
			`<div><div id="containedUser" class="item-1BCeuB role-member">
			<div class="itemCheckbox-2G8-Td">
				<div class="avatar-1XUb0A wrapper-1VLyxH" role="img" aria-hidden="false" style="width: 32px; height: 32px;">
					<svg width="40" height="32" viewBox="0 0 40 32" class="mask-1FEkla svg-2azL_l" aria-hidden="true">
						<foreignObject x="0" y="0" width="32" height="32" mask="url(#svg-mask-avatar-default)">
						<div class="avatarStack-3vfSFa">
							<img src="{{avatar_url}}" alt=" " class="avatar-b5OQ1N" aria-hidden="true">
						</div>
						</foreignObject>
					</svg>
				</div>
			</div>
			<div class="itemLabel-27pirQ">
				<span class="username">
					{{username}}
				</span>
				<span class="discriminator-2jnrqC">
					{{discriminator}}
				</span>
				<table id="emojies">
				</table>
			</div>
		</div></div>`;


		const currentObject = this.containedObjects[objectIterator];

		const user = this.getUser(currentObject.id)

		const elem = ZeresPluginLibrary.DOMTools.createElement(ZeresPluginLibrary.Utilities.formatString(popoutHTML,
			{ username: user.username, discriminator: "#" + user.discriminator, avatar_url: user.getAvatarURL() }))

		const row = document.createElement('tr');
		row.style.display = 'inline-flex';
		for (var emojiesIterator = 0; emojiesIterator < currentObject.reactions.length; emojiesIterator++) {
			row.innerHTML += `<td coldspan ='2'>${this.getReactionTextToDisplay(this.containedObjects[objectIterator].reactions[emojiesIterator])}</td>`;

			elem.querySelector('table').append(row);

		}
		elem.addEventListener('click', () => {
			const elements = [];
			const reactionsInput = this.parseHTML(
				`<div class="container-2oNtJn medium-2NClDM">			
						<div class="inner-2pOSmK">
							<input type="text" class="input-2m5SfJ" name="message" placeholder="${this.labels.input_reactions}" id="input_reactions"/>
						</div>
					</div>`
			);

			const emojies = this.parseHTML(
				`<table id="emojiesToAdd">
				</table>`
			)
			reactionsInput.querySelector('input').value = currentObject.reactions.join(' ');
			reactionsInput.addEventListener('input', () => {
				const value = document.getElementById('input_reactions').value.trim();
				const table = document.getElementById('emojiesToAdd');
				table.innerHTML = '';
				const row = document.createElement('tr');
				row.style.display = 'inline-flex';
				value.split(' ').forEach(reaction => {
					const textToDisplay = this.getReactionTextToDisplay(reaction);
					if (textToDisplay != '') {
						row.innerHTML += `<td coldspan ='2'>${textToDisplay}</td>`;
					}
				});
				emojies.append(row);
			});
			const row = document.createElement('tr');
			row.style.display = 'inline-flex';
			currentObject.reactions.forEach(reaction => {

				const textToDisplay = this.getReactionTextToDisplay(reaction);
				if (textToDisplay != '') {
					row.innerHTML += `<td coldspan ='2'>${textToDisplay}</td>`;
				}
			});
			const containingMethodText = this.parseHTML(`<span style="color:#dddddd">${this.labels.containing_method_text}: </span>`);

			const radioGroup = [
				{
					name: this.labels.containing_method_reactions,
					value: 'reactions',
					desc: '',
					color: '#DDDDDD'
				},
				{
					name: this.labels.containing_method_message,
					value: 'message',
					desc: '',
					color: '#DDDDDD'
				}
			];
			var containingMethod = currentObject.method;
			const containingMethodRadioGroup = new ZeresPluginLibrary.Settings.RadioGroup('', '', currentObject.method, radioGroup, (method) => {
				containingMethod = method;
			}).getElement();

			elements.push(containingMethodText);
			elements.push(containingMethodRadioGroup);

			emojies.append(row);

			elements.push(reactionsInput);
			elements.push(emojies);
			ZeresPluginLibrary.Modals.showModal(this.labels.add_object_button, ZeresPluginLibrary.ReactTools.createWrappedElement(elements), {
				confirmText: this.labels.delete_object,
				cancelText: this.labels.save_settings,
				size: ZeresPluginLibrary.Modals.ModalSizes.SMALL,
				red: false,
				onConfirm: e => {
					this.containedObjects.splice(objectIterator, 1);
					this.saveSettings();
					elem.innerHTML = '';
				},
				onCancel: t => {
					if (!currentObject) // was deleted
						return;
					const value = document.getElementById('input_reactions').value.trim();
					elem.querySelector('table').innerHTML = '';
					if (value != '') {

						currentObject.reactions = [];
						const reactions = value.split(' ');
						const row = document.createElement('tr');
						row.style.display = 'inline-flex';
						reactions.forEach(reaction => {
							const textToDisplay = this.getReactionTextToDisplay(reaction);
							if (textToDisplay != '') {
								row.innerHTML += `<td coldspan ='2'>${textToDisplay}</td>`;
								currentObject.reactions.push(reaction);
							}
						});
						elem.querySelector('table').append(row);
					} else {
						currentObject.reactions = [];

					}
					currentObject.method = containingMethod;
					this.saveSettings();
				}


			});
		});
		const objects = document.getElementById('containedObjects');
		if (objects) {
			objects.append(elem); // add new user
		}
		if (html) {
			html.querySelectorAll('div')[1].append(elem);
			// фиксим странный новый баг. 
			// Типо элемент ещё не появился и мы не можем через document.getElementById() добавить другие элементы, поэтому передаём элемент в функцию
		}
	}

	getReactionTextToDisplay(reaction) {
		const emoji = this.GetByNameEmojieWebPack.getByName(reaction);
		var textToDisplay = '';
		if (emoji) {
			textToDisplay = `<img aria-label="${emoji.surrogates}" src="${this.getEmojiUrl(emoji.surrogates)}" alt="${emoji.surrogates}" draggable="false" class="emoji jumboable" data-type="emoji" data-name=":${reaction}:"></img>`;
		}
		else {
			const customEmoji = this.getCustomEmoji(reaction);
			if (customEmoji) {
				textToDisplay = `<img aria-label=":${reaction}:" src=${customEmoji.url} alt=":${reaction}:" draggable="false" class="emoji jumboable" data-type="emoji" data-id="${customEmoji.id}"></img>`;
			}
		}
		return textToDisplay;
	}
	renderUser(user) {
		const popoutHTML =
			`<div class="item-1BCeuB role-member">
		<div class="itemCheckbox-2G8-Td">
			<div class="avatar-1XUb0A wrapper-1VLyxH" role="img" aria-hidden="false" style="width: 32px; height: 32px;">
				<svg width="40" height="32" viewBox="0 0 40 32" class="mask-1FEkla svg-2azL_l" aria-hidden="true">
					<foreignObject x="0" y="0" width="32" height="32" mask="url(#svg-mask-avatar-default)">
					<div class="avatarStack-3vfSFa">
						<img src="{{avatar_url}}" alt=" " class="avatar-b5OQ1N" aria-hidden="true">
					</div>
					</foreignObject>
				</svg>
			</div>
		</div>
		<div class="itemLabel-27pirQ">
			<span class="username">
				{{username}}
			</span>
			<span class="discriminator-2jnrqC">
				{{discriminator}}
			</span>
		
		</div>
		<div id="confirmAdd">
		</div>
	</div>`;


		const elem = ZeresPluginLibrary.DOMTools.createElement(ZeresPluginLibrary.Utilities.formatString(popoutHTML,
			{ username: user.username, discriminator: "#" + user.discriminator, avatar_url: user.getAvatarURL() }))
		return elem;

	}
	renderUserToAdd(user) {
		const element = this.renderUser(user);

		element.addEventListener('click', () => {
			const div = document.getElementById('usertoadd');
			div.innerHTML = '';
			const userToAdd = this.renderUser(user);
			Array.from(userToAdd.querySelectorAll('div')).find(e => e.id == 'confirmAdd').append(this.createButton(this.labels.add_object_button, () => {
				if (!user.username || !user.id || this.containedObjects.find(object => object.id == user.id)) // если уже есть, то не добавляем
					return;
				this.containedObjects.push({
					'name': user.username,
					'id': user.id,
					'reactions': [],
					'method': 'reactions'
				});
				this.saveSettings();
				document.getElementById('confirm_add_button').firstChild.textContent = this.labels.confirmed_add_button;
				this.renderContainedObject(this.containedObjects.length - 1);

			}, 'confirm_add_button'));
			div.append(userToAdd);
		});
		document.getElementById('findObjects').append(element);

	}

	loadSettings() {
		if (!this.fs.existsSync(this.configPath)) {
			this.fs.writeFileSync(this.configPath, JSON.stringify([{}])); // create empty config
		}
		var settings = [];
		try {
			settings = JSON.parse(this.fs.readFileSync(this.configPath));
		}
		catch {
			this.fs.writeFileSync(this.configPath, JSON.stringify([{}])); // create empty config
			settings = JSON.parse(this.fs.readFileSync(this.configPath));
		}
		return settings;
	}

	setLabelsByLanguage() {
		switch (ZeresPluginLibrary.WebpackModules.getByProps('getLocale')?.getLocale() || document.querySelector("html[lang]").getAttribute("lang")) {
			case 'ru':
				return {
					add_button: 'Добавить объект для сдерживания',
					input_id: 'Введите ID пользователя',
					input_name: 'Введите имя пользователя',
					add_object: 'Добавить объект',
					input_find: 'Поиск по имени',
					input_reactions: 'Введите эмодзи',
					containing_method_text: 'Способ сдерживания',
					object_settings: 'Настройка объекта',
					add_object_button: 'Добавить',
					confirmed_add_button: 'Добавлен',
					delete_object: 'Удалить объект',
					save_settings: 'Сохранить настройки',
					containing_method_reactions: 'Реакции',
					containing_method_message: 'Сообщение'
				}
			default:
				return {
					add_button: 'Add object for containing',
					input_id: 'Enter user ID',
					input_name: 'Enter user name',
					add_object: 'Add object',
					input_find: 'Search by name',
					input_reactions: 'Enter emojies',
					containing_method_text: 'Containing method',
					object_settings: 'Object settings',
					add_object_button: 'Add',
					confirmed_add_button: 'Added',
					delete_object: 'Delete object',
					save_settings: 'Save settings',
					containing_method_reactions: 'Reactions',
					containing_method_message: 'Message'
				}
		}

	}
	checkLibraries(libraries) {
		const div = BdApi.React.createElement('div', {});
		div.props.children = [];
		const createMissingLibraryText = (libraryName, libraryUrl) => {
			return BdApi.React.createElement('div', {}, BdApi.React.createElement('a', {
				href: libraryUrl,
				target: '_blank'
			}, libraryName),
				BdApi.React.createElement('span', { style: { color: 'white' } }, ' was missing'));
		}
		var hasAllLibs = true;
		for (const library of libraries) {
			if (!global[library.name]) {
				hasAllLibs = false;
				div.props.children.push(createMissingLibraryText(library.name, library.url));
				fetch(library.url).then(function (response) {
					return response.text();
				}).then(function (file) {
					require('fs').writeFileSync(require('path').join(BdApi.Plugins.folder, library.filename), file);
				});
			}
		}
		if (!hasAllLibs) {
			div.props.children.push(BdApi.React.createElement('span', { style: { color: 'white' } }, 'Please, reload plugin'))
			BdApi.alert('Missing libraries were downloaded', div);
			BdApi.Plugins.disable(this.name);
			return false;
		}
		return true;
	}
	stop() {
		console.log(`${this.name}: stopped!`);
		BdApi.Patcher.unpatchAll(this.name);
	}

}

