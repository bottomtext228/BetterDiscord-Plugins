/**
 * @name OCS
 * @version 2.2.7
 * @description Orpheus Containment System.
 * @author bottom_text | Z-Team
 * @source https://github.com/bottomtext228/BetterDiscord-Plugins/tree/main/Plugins/OCS
 * @updateUrl https://raw.githubusercontent.com/bottomtext228/BetterDiscord-Plugins/main/Plugins/OCS/OCS.plugin.js
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

		console.log(`${this.name}: started!`);

		this.findWebPacks();

		this.loadSettings();
		this.labels = this.setLabelsByLanguage();
		this.sendedMessages = [];

		this.emojiType = {
			unicode: 0,
			custom: 1
		};

		this.containingMethod = {
			reactions: 0,
			message: 1
		}


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
			this.ComponentDispatchWebpack, 
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
			const currentObject = this.containedObjects.find(object => { // HERE
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

				if (currentObject.method == this.containingMethod.reactions) {
					const sendAsync = async () => {
						const wait = (ms) => {
							return new Promise((resolve, reject) => {
								setTimeout(resolve, ms);
							})
						}
						for (const reaction of currentObject.reactions) {
							this.sendReaction(dispatch.message.channel_id, dispatch.message.id, reaction);
							await wait(100);
						}
					}
					sendAsync();
				} else if (currentObject.method == this.containingMethod.message) {
					var message = '';
					currentObject.reactions.forEach(reaction => {
						message += this.prepareEmojiToSend(reaction, true) + ' ';
					});

					if (!isLocalUser || !this.sendedMessages.some(e => e.messageId == dispatch.message.id)) { // избегаем "рекурсии" при работе на локального пользователя
						this.sendMessage(dispatch.message.channel_id, message, (response) => {
							if (response.ok) {
								if (this.sendedMessages.length >= 75) { // MAX_SIZE. Prevent memory leaks
									const message = this.sendedMessages.shift();
									this.deleteMessage(message.channelId, message.messageId);

								} // чтобы удалить свои сообщения в последствии надо сохранить их id 
								this.sendedMessages.push({
									messageId: response.body.id,
									repliedMessageId: dispatch.message.id,
									channelId: dispatch.message.channel_id
								});

							}
						});
					}
				}

			}


		}
		if (dispatch.type == 'MESSAGE_DELETE') {
			/* Если жертва удаляет свои сообщения, мы удаляем свои  */
			const message = this.sendedMessages.find(e => e.repliedMessageId == dispatch.id);
			if (message) {
				this.deleteMessage(dispatch.channelId, message.messageId);
				this.sendedMessages.splice(this.sendedMessages.indexOf(message), 1);
			}
		}

	}

	sendMessage(channelId, content, responseCallback) {
		this.MessageQueueWebPack.enqueue({
			type: 0,
			message: {
				channelId: channelId,
				content: content,
			} // callback is called when we get server's response
		}, typeof (responseCallback) == 'function' ? responseCallback : () => { });
	}

	deleteMessage(channelId, messageId) {
		return this.MessageUtilitiesWebPack.deleteMessage(channelId, messageId);
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
		return this.GetUserWebPack.getCurrentUser();
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

	sendReaction(channelId, messageId, emoji) {
		this.ReactionUtilities.rU(channelId, messageId, this.prepareEmojiToSend(emoji), undefined, { burst: false });
	}

	prepareEmojiToSend(emoji, toString = false) { // tostring - bool. false - return object for addReaction, true - return string for message

		if (emoji.type == this.emojiType.unicode) {
			const unicodeEmoji = this.GetByNameemojiWebPack.getByName(emoji.name);
			if (unicodeEmoji) {
				return toString ? unicodeEmoji.surrogates : {
					id: unicodeEmoji.id == undefined ? null : unicodeEmoji.id,
					name: unicodeEmoji.surrogates,
					animated: unicodeEmoji.animated,
				}
			}
		}
		else {
			const customEmoji = this.getCustomEmojiById(emoji.id);
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

	getCustomEmojiById(customEmojiId) {
		return this.GuildUtilities.getCustomEmojiById(customEmojiId);
	}

	createButton(label, callback, id) {
		const ret = this.parseHTML(`<button type="button" class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
		if (callback) {
			ret.addEventListener('click', callback);
		}
		return ret;
	}

	createInput(label, id, callback) {
		const ret = this.parseHTML(
			`<div class="${this.InputConstants.container} ${this.InputConstants.medium}">
				<div class="${this.InputConstants.inner}">
					<input type="text" class="${this.InputConstants.input}" name="message" placeholder="${label}" id="${id}"/>
				</div>
			</div>`
		);
		if (callback) {
			ret.addEventListener('input', callback);
		}
		return ret;
	}

	parseHTML(html) {
		var template = document.createElement('template');
		html = html.trim(); // Never return a text node of whitespace as the result
		template.innerHTML = html;
		return template.content.firstChild;
	}

	findWebPacks() {

		/* зачем все эти приколы с эмодзи помещать в разные модули??? */


		this.ReactionUtilities = ZeresPluginLibrary.WebpackModules.getByProps('rU', 'wX'); // ...
		this.EmojiUtilitiesWebpack = ZeresPluginLibrary.WebpackModules.getByProps('getURL');
		this.GuildUtilities = ZeresPluginLibrary.WebpackModules.getByProps('getGuildEmoji');
		this.GetByNameemojiWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getByName');

		this.ComponentDispatchWebpack = ZeresPluginLibrary.WebpackModules.getByProps('S', 'b').S // ...
		this.DispatchWebPack = ZeresPluginLibrary.WebpackModules.find(e => e.dispatch && !e.getCurrentUser);
		this.GetGuildWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getGuild', 'getGuildCount');
		this.GetMembersWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getMembers');
		this.GetUserWebPack = ZeresPluginLibrary.WebpackModules.getByProps('getUser', 'getCurrentUser');
		this.MessageQueueWebPack = ZeresPluginLibrary.WebpackModules.getByProps('enqueue');
		this.MessageUtilitiesWebPack = ZeresPluginLibrary.WebpackModules.getByProps('deleteMessage');
		this.ButtonConstansts = ZeresPluginLibrary.WebpackModules.getByProps('lookBlank');

		this.UserTagConstants = { ...ZeresPluginLibrary.WebpackModules.getByProps('userTagUsernameNoNickname'), ...ZeresPluginLibrary.WebpackModules.getByProps('defaultColor') };
		this.InputConstants = { ...ZeresPluginLibrary.WebpackModules.getByProps('input', 'icon', 'close', 'pointer') }

	}

	getSettingsPanel() {

		const menuHTML =
			`<div id="main">

			<button type="button" id="add_button" style="width:565px"
				class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}">
				<div class="contents-3ca1mk">${this.labels.add_button}</div>
			</button>
					
			<div id="containedObjects" style="margin-top: 16px"> 
			</div>
			
		</div>`


		const allUsers = [];
		this.allEmojis = [];

		const html = ZeresPluginLibrary.DOMTools.createElement(menuHTML);


		const buttons = Array.from(html.querySelectorAll('button'));

		buttons.find(button => button.id == 'add_button').addEventListener('click', () => {

			const elements = [];

			const userToAdd = this.parseHTML(`<div id="usertoadd"></div>`);
			const input_id = this.createInput(this.labels.input_id, 'input_id', () => {
				const userIdToFind = document.getElementById('input_id').value.trim();
				if (userIdToFind == '')
					return;
				const user = this.getUser(userIdToFind)
				if (user) {
					this.renderUserToAdd(user);
				}
			});


			const membersTable = this.parseHTML(`<table id="findObjects"></table>`);

			const input_name = this.createInput(this.labels.input_name, 'input_name', () => {

				const usernameToFind = document.getElementById('input_name').value.trim();

				if (usernameToFind == '')
					return;
				membersTable.innerHTML = '';
				for (var membersIterator = 0; membersIterator < allUsers.length; membersIterator++) {
					const member = allUsers[membersIterator];

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


		for (let objectIterator in this.containedObjects) {
			this.renderContainedObject(objectIterator, html)
		}



		for (const guildId in this.getGuilds()) { // get all users. We can do it by get all users of all guilds we are in 
			const members = this.getMembers(guildId);
			for (const member of members) {
				if (!allUsers.some(e => e && e.id == member.userId)) {
					const user = this.getUser(member.userId);
					allUsers.push(user);

				}
			}
			// get all guild emojis
			this.allEmojis.push(...this.GuildUtilities.getGuildEmoji(guildId).map(e => { return { name: e.name, id: e.id, type: this.emojiType.custom } }));

		} // get all unicode emojis
		this.allEmojis.push(...this.GetByNameemojiWebPack.all().map(e => { return { name: e.uniqueName, type: this.emojiType.unicode } }));


		if (this.sendedMessages.length > 0) {
			const deleteButton =
				this.parseHTML(
					`<button type="button" id="delete_button" style="width:565px"
				class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}">
				<div class="contents-3ca1mk">${this.labels.delete_button}</div>
				</button>`
				);
			deleteButton.addEventListener('click', async e => {
				const wait = (ms) => {
					return new Promise((resolve, reject) => {
						setTimeout(resolve, ms);
					})
				}
				for (let messageIndex in this.sendedMessages) {
					const message = this.sendedMessages[messageIndex];
					this.deleteMessage(message.channelId, message.messageId);
					await wait(500); // prevent rate limit
				}
				this.sendedMessages = [];
			})
			html.append(deleteButton);
		}
		return html;
	}

	renderContainedObject(objectIterator, html) {

		const popoutHTML =
			`<div>	
				<div id="containedUser" style="margin-top: 10px">
					<div style="display: flex; justify-content: left;">
						<img style="height: 32px; height: 32px; border-radius: 50%;" src="{{avatar_url}}">			
						<div style="margin-left: 10px; margin-top: 5px">
							<span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
								{{username}}
							</span>
							<span class="${this.UserTagConstants.discrimBase}">
								{{discriminator}}
							</span>
						</div>
					</div>
				</div>
				<div style="margin-left: 40px;">
					<div id="emojis" style="display: flex; flex-wrap: wrap; gap: 5px;">
					</div>
				</div>
			</div>`;

		const currentObject = this.containedObjects[objectIterator];

		const user = this.getUser(currentObject.id);

		if (!user) {
			return;
		}

		const elem = ZeresPluginLibrary.DOMTools.createElement(ZeresPluginLibrary.Utilities.formatString(popoutHTML,
			{ username: user.username, discriminator: "#" + user.discriminator, avatar_url: user.getAvatarURL() }));


		currentObject.reactions.forEach(reaction => {
			Array.from(elem.querySelectorAll('div')).find(e => e.id == 'emojis').append(
				this.parseHTML(`<div>${this.getReactionTextToDisplay(reaction)}</div>`)
			)
		});

		elem.addEventListener('click', () => { // object settings 
			const elements = [];
			const currentObjectReactions = Object.assign([], currentObject.reactions);

			const reactionsInput = this.createInput(this.labels.input_reactions, 'input_reactions', (e) => {
				
				const value = document.getElementById('input_reactions').value.trim(); // HERE
				const table = document.getElementById('emojisToAdd');
				table.innerHTML = '';
			
				currentObjectReactions.forEach(reaction => { // HERE
					const textToDisplay = this.getReactionTextToDisplay(reaction);
					if (textToDisplay != '') {
						const reactionElement = this.parseHTML(`<div>${this.getReactionTextToDisplay(reaction)}</div>`);
						reactionElement.addEventListener('click', (e) => {
							// delete 
							e.target.parentElement.outerHTML = ''; // order is important or parentElement will be undefined
							e.target.parentElement.innerHTML = '';

							currentObjectReactions.splice(currentObjectReactions.indexOf(reaction), 1);
					
						})
						emojis.append(reactionElement);
					}
				});

			
				const emojisQueryList = document.getElementById('emojisQueryList');
				emojisQueryList.innerHTML = '';


				if (value.length > 1) {
					for (const emoji of this.allEmojis) {
						if (emoji.name.toLowerCase().search(value.toLowerCase()) != -1) {


							const emojiQueryResult = this.parseHTML(
							`<div style="height: 50px; margin-top: 10px; margin-bottom: 10px; display: flex; align-items: center;">						
								<div style="width: 50px;">${this.getReactionTextToDisplay(emoji)}</div>
								<div style="width: 100px; margin-left: 2%; color: white">:${emoji.name}:</div>
								${emoji.type == this.emojiType.custom ? `<div style="color: grey; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: right;">${this.getGuild(this.getCustomEmojiById(emoji.id).guildId).name}</div>` : ''}
							</div>`);
	
							emojiQueryResult.addEventListener('click', () => {

								if (!currentObjectReactions.some(e => _.isEqual(e, emoji))) { // if not already added
									currentObjectReactions.push(emoji);
									const reactionElement = this.parseHTML(`<div>${this.getReactionTextToDisplay(emoji)}</div>`);
									reactionElement.addEventListener('click', (e) => {
										// delete reaction 

										e.target.parentElement.outerHTML = ''; // order is important or parentElement will be undefined
										e.target.parentElement.innerHTML = '';

										currentObjectReactions.splice(currentObjectReactions.indexOf(emoji), 1);
							
									})
									emojis.append(reactionElement);
								}
							})
							emojisQueryList.append(emojiQueryResult);
						}
					}
				}



			});

	
			const emojis = this.parseHTML(
				`<div id="emojisToAdd" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px auto 10px;">
				</div>`
			)

			const emojisQueryList = this.parseHTML('<div id="emojisQueryList"></div>');
	
			currentObject.reactions.forEach(reaction => {


				const textToDisplay = this.getReactionTextToDisplay(reaction);
				if (textToDisplay != '') {
					const reactionElement = this.parseHTML(`<div>${textToDisplay}</div>`);
					reactionElement.addEventListener('click', (e) => {
						// delete 
						e.target.parentElement.outerHTML = ''; // order is important or parentElement will be undefined
						e.target.parentElement.innerHTML = '';
					
						currentObjectReactions.splice(currentObjectReactions.indexOf(reaction), 1);
		
					})
					emojis.append(reactionElement);
				}
			});



			const containingMethodText = this.parseHTML(`<span style="color:#dddddd">${this.labels.containing_method_text}: </span>`);

			const radioGroup = [
				{
					name: this.labels.containing_method_reactions,
					value: this.containingMethod.reactions,
					desc: '',
					color: '#DDDDDD'
				},
				{
					name: this.labels.containing_method_message,
					value: this.containingMethod.message,
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

		
			elements.push(emojis);

			elements.push(reactionsInput);


			elements.push(emojisQueryList);

			ZeresPluginLibrary.Modals.showModal(this.labels.add_object_button, ZeresPluginLibrary.ReactTools.createWrappedElement(elements), {
				confirmText: this.labels.delete_object,
				cancelText: this.labels.save_settings,
				size: ZeresPluginLibrary.Modals.ModalSizes.SMALL,
				red: false,
				onConfirm: e => { // delete object
					this.containedObjects.splice(objectIterator, 1);
					this.saveSettings();
					elem.innerHTML = '';
				},
				onCancel: t => { // save object
					if (!currentObject) // was deleted
						return;


					const emojisList = Array.from(elem.querySelectorAll('div')).find(e => e.id == 'emojis');
					emojisList.innerHTML = '';

		
					currentObject.reactions = [];
					const reactions = currentObjectReactions;
					if (reactions.length > 0) {
						reactions.forEach(reaction => {
							const textToDisplay = this.getReactionTextToDisplay(reaction);
							if (textToDisplay != '') {						
								emojisList.append(
									this.parseHTML(`<div>${this.getReactionTextToDisplay(reaction)}</div>`)
								);
								currentObject.reactions.push(reaction);
							}
						});
						
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
		var textToDisplay = '';
		if (reaction.type == this.emojiType.unicode) {
			const emoji = this.GetByNameemojiWebPack.getByName(reaction.name);
			if (emoji) {
				textToDisplay = `<img aria-label="${emoji.surrogates}" src="${this.getEmojiUrl(emoji.surrogates)}" alt="${emoji.surrogates}" draggable="false" class="emoji jumboable" data-type="emoji"></img>`;
			}
		}
		else {
			const customEmoji = this.getCustomEmojiById(reaction.id);
			if (customEmoji) {
				textToDisplay = `<img aria-label=":${customEmoji.name}:" src=${customEmoji.url} alt=":${customEmoji.name}:" draggable="false" class="emoji jumboable" data-type="emoji" data-id="${customEmoji.id}"></img>`;
			}
		}
		return textToDisplay;
	}

	renderUser(user) {
		const popoutHTML =
			`<div>
			<div style="margin-top: 10px; margin-bottom: 10px; display: flex; justify-content: left;">
				<img style="height: 32px; height: 32px; border-radius: 50%;" src="{{avatar_url}}">			
				<span style="margin-left: 10px; margin-top: 5px">
					<span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
						{{username}}
					</span>
					<span class="${this.UserTagConstants.discrimBase}">
						{{discriminator}}
					</span>
					</span>
				<div id="confirmAdd" style="margin-right: 0px; margin-left: auto;"></div>
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
					'reactions': [], // HERE ?
					'method': this.containingMethod.reactions
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
		this.containedObjects = BdApi.loadData(this.name, 'data');
		if (!this.containedObjects) {
			this.containedObjects = [];
		}
	}

	saveSettings() {	
		BdApi.saveData(this.name, 'data', this.containedObjects);
	}

	setLabelsByLanguage() {
		switch (ZeresPluginLibrary.WebpackModules.getByProps('getLocale')?.getLocale() || document.querySelector("html[lang]").getAttribute("lang")) {
			case 'ru':
				return {
					add_button: 'Добавить объект для сдерживания',
					input_id: 'Введите ID пользователя',
					input_name: 'Введите имя пользователя',
					add_object: 'Добавить объект',
					input_reactions: 'Поиск эмодзи',
					containing_method_text: 'Способ сдерживания',
					object_settings: 'Настройка объекта',
					add_object_button: 'Добавить',
					confirmed_add_button: 'Добавлен',
					delete_object: 'Удалить объект',
					save_settings: 'Сохранить настройки',
					containing_method_reactions: 'Реакции',
					containing_method_message: 'Сообщение',
					delete_button: 'Удалить сообщения'
				}
			default:
				return {
					add_button: 'Add object for containing',
					input_id: 'Enter user ID',
					input_name: 'Enter user name',
					add_object: 'Add object',
					input_reactions: 'Search emoji',
					containing_method_text: 'Containing method',
					object_settings: 'Object settings',
					add_object_button: 'Add',
					confirmed_add_button: 'Added',
					delete_object: 'Delete object',
					save_settings: 'Save settings',
					containing_method_reactions: 'Reactions',
					containing_method_message: 'Message',
					delete_button: 'Delete messages'
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
