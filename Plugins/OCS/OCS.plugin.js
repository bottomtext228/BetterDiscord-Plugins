/**
 * @name OCS
 * @version 2.3.3
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
		console.log(`${this.name}: started!`);

		this.findWebpacks();

		this.loadSettings();
		this.labels = this.setLabelsByLanguage();
		this.sendedMessages = [];
		this.previousMessageContent = '';

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
			this.DispatchWebpack,
			'dispatch',
			(_, args) => this.onDispatchEvent(args)
		);
		// хукаем обработчик основных событий, включая сообщения.
		// before, чтобы не конфликтовало с другими плагинами, хукающими dispatch, так как нам надо только считывать данные 

	}

	onDispatchEvent(args) { // обработчик событий 
		const dispatch = args[0];
		if (!dispatch)
			return;

		if (dispatch.type == 'MESSAGE_CREATE') {
			const currentObject = this.containedObjects.find(object => object.id == dispatch.message.author.id);

			if (currentObject) {

				if (currentObject.method == this.containingMethod.reactions) {
					const sendAsync = async () => {
						const wait = (ms) => {
							return new Promise((resolve) => {
								setTimeout(resolve, ms);
							});
						}
						for (const reaction of currentObject.reactions) {
							this.sendReaction(dispatch.message.channel_id, dispatch.message.id, reaction);
							await wait(100);
						}
					}
					sendAsync();
				} else if (currentObject.method == this.containingMethod.message) {
					var reactionMessage = '';
					currentObject.reactions.forEach(reaction => {
						reactionMessage += this.prepareEmojiToSend(reaction, true) + ' ';
					});
					this.previousMessageContent = reactionMessage;
					this.sendMessage(dispatch.message.channel_id, reactionMessage, (response) => {
						if (response.ok) {
							if (this.sendedMessages.length >= 75) { // MAX_SIZE. Prevent memory leaks
								const message = this.sendedMessages.shift();
								this.deleteMessage(message.channelId, message.messageId);

							}
							// чтобы удалить свои сообщения в последствии надо сохранить их id 
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
		this.MessageQueueWebpack.enqueue({
			type: 0,
			message: {
				channelId: channelId,
				content: content,
			} // callback is called when we get server's response
		}, typeof (responseCallback) == 'function' ? responseCallback : () => { });
	}

	deleteMessage(channelId, messageId) {
		return this.MessageUtilitiesWebpack.deleteMessage(channelId, messageId);
	}

	getMembers(guildId) {
		return this.GetMembersWebpack.getMembers(guildId);
	}

	getGuild(guildId) {
		return this.GetGuildWebpack.getGuild(guildId);
	}

	getGuilds() {
		return this.GuildUtilitiesWebpack.getGuilds();
	}

	getCurrentUser() {
		return this.GetUserWebpack.getCurrentUser();
	}

	getUser(id) {
		return this.GetUserWebpack.getUser(id);
	}

	getEmojiUrlFromSurrogate(emojiSurrogate) { // example: '🐖' -> '/assets/d083412544c302d290775006877f6202.svg'
		return this.EmojiUtilitiesWebpack.getURL(emojiSurrogate)
	}

	getCustomEmojiUrl(customEmojiId) {
		return this.UrlUtilitiesWebpack.getEmojiURL({ id: customEmojiId, size: 34 });
	}

	sendReaction(channelId, messageId, emoji) {
		this.ReactionUtilitiesWebpackWithKey[0][this.ReactionUtilitiesWebpackWithKey[1]](channelId, messageId, this.prepareEmojiToSend(emoji), undefined, { burst: false });
	}

	prepareEmojiToSend(emoji, toString = false) { // tostring - bool. false - return object for addReaction, true - return string for message
		if (emoji.type == this.emojiType.unicode) {
			const unicodeEmoji = this.EmojiUtilitiesWebpack.getByName(emoji.name);
			if (unicodeEmoji) {
				return toString ? unicodeEmoji.surrogates : {
					id: unicodeEmoji.id == undefined ? null : unicodeEmoji.id,
					name: unicodeEmoji.surrogates,
					animated: unicodeEmoji.animated,
				};
			}
		}
		else {
			const customEmoji = this.getCustomEmojiById(emoji.id);
			if (customEmoji) {
				return toString ? `<${customEmoji.animated ? 'a' : ''}:${customEmoji.name}:${customEmoji.id}>` : {
					id: customEmoji.id == undefined ? null : customEmoji.id,
					name: customEmoji.name,
					animated: customEmoji.animated,
				};
			}
		}
		return '';
	}

	getCustomEmojiById(customEmojiId) {
		return this.GuildUtilitiesWebpack.getCustomEmojiById(customEmojiId);
	}

	wrapElement(element) {
		const wrap = (elements) => {
			const domWrapper = BdApi.DOM.parseHTML(`<div class="dom-wrapper"></div>`);
			for (let e = 0; e < elements.length; e++) domWrapper.appendChild(elements[e]);
			return domWrapper;
		}
		if (Array.isArray(element)) element = wrap(element);
		return BdApi.React.createElement(BdApi.ReactUtils.wrapElement(element));
	}

	createButton(label, callback, id) {
		const ret = BdApi.DOM.parseHTML(`<button type="button" class="${this.ButtonConstansts.button} ${this.ButtonConstansts.lookFilled} ${this.ButtonConstansts.colorBrand} ${this.ButtonConstansts.sizeSmall} ${this.ButtonConstansts.grow}" ${(id ? 'id="' + id + '"' : '')}><div class="contents-3ca1mk">${label}</div></button>`);
		if (callback) {
			ret.addEventListener('click', callback);
		}
		return ret;
	}

	createInput(label, id, callback) {
		const ret = BdApi.DOM.parseHTML(
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

	findWebpacks() {
		this.ReactionUtilitiesWebpackWithKey = [...BdApi.Webpack.getWithKey(
			BdApi.Webpack.Filters.byStrings('MESSAGE_REACTION_ADD', 'void 0!==arguments[3]?arguments[3]:"Message"'))];

		this.EmojiUtilitiesWebpack = { ...BdApi.Webpack.getByKeys('getURL'), ...BdApi.Webpack.getByKeys('getByName') };
		this.GuildUtilitiesWebpack = BdApi.Webpack.getByKeys('getGuildEmoji');
		this.UrlUtilitiesWebpack = BdApi.Webpack.getByKeys('getEmojiURL');
		this.DispatchWebpack = BdApi.Webpack.getByKeys('actionLogger', 'dispatch', 'subscribe', { searchExports: true });
		this.GetGuildWebpack = BdApi.Webpack.getByKeys('getGuild', 'getGuildCount');
		this.GetMembersWebpack = BdApi.Webpack.getByKeys('getMembers', 'getNick');
		this.GetUserWebpack = BdApi.Webpack.getByKeys('getUser', 'getCurrentUser');
		this.MessageQueueWebpack = BdApi.Webpack.getByKeys('enqueue', 'maxSize');
		this.MessageUtilitiesWebpack = BdApi.Webpack.getByKeys('deleteMessage', 'sendMessage', 'editMessage');
		this.ButtonConstansts = BdApi.Webpack.getByKeys('lookBlank');

		this.UserTagConstants = { ...BdApi.Webpack.getByKeys('userTagUsernameNoNickname'), ...BdApi.Webpack.getByKeys('defaultColor') };
		this.InputConstants = BdApi.Webpack.getByKeys('input', 'inner', 'close');
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

		const html = BdApi.DOM.parseHTML(menuHTML);


		const buttons = Array.from(html.querySelectorAll('button'));

		buttons.find(button => button.id == 'add_button').addEventListener('click', () => {

			const elements = [];

			const userToAdd = BdApi.DOM.parseHTML(`<div id="usertoadd"></div>`);
			const input_id = this.createInput(this.labels.input_id, 'input_id', () => {
				const userIdToFind = document.getElementById('input_id').value.trim();
				if (userIdToFind == '') return;
				const user = this.getUser(userIdToFind)
				if (user && user.id != this.getCurrentUser().id) {
					this.renderUserToAdd(user);
				}
			});


			const membersTable = BdApi.DOM.parseHTML(`<table id="findObjects"></table>`);

			const input_name = this.createInput(this.labels.input_name, 'input_name', () => {

				const usernameToFind = document.getElementById('input_name').value.trim();

				if (usernameToFind == '') return;

				membersTable.innerHTML = '';

				for (var membersIterator = 0; membersIterator < allUsers.length; membersIterator++) {
					const member = allUsers[membersIterator];

					if (member.username.toLowerCase().search(usernameToFind.toLowerCase()) != -1 && member.id != this.getCurrentUser().id) {
						this.renderUserToAdd(member);
					}
				}

			});


			const padding = BdApi.DOM.parseHTML(`<pre>&nbsp</pre>`);

			elements.push(userToAdd);
			elements.push(input_id);
			elements.push(padding);
			elements.push(input_name);
			elements.push(membersTable);

			BdApi.UI.showConfirmationModal(this.labels.add_object, this.wrapElement(elements), {
				confirmText: 'OK',
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
			this.allEmojis.push(...this.GuildUtilitiesWebpack.getGuildEmoji(guildId).map(e => { return { name: e.name, id: e.id, type: this.emojiType.custom } }));

		} // get all unicode emojis

		this.EmojiUtilitiesWebpack.forEach(e => this.allEmojis.push({ name: e.uniqueName, type: this.emojiType.unicode }));

		if (this.sendedMessages.length > 0) {
			const deleteButton =
				BdApi.DOM.parseHTML(
					`<button type="button" id="delete_button" style="width:565px; margin-top: 16px"
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

		const currentObject = this.containedObjects[objectIterator];

		const user = this.getUser(currentObject.id);

		if (!user) {
			return;
		}

		const popoutHTML =
			`<div>	
				<div id="containedUser" style="margin-top: 10px">
					<div style="display: flex; justify-content: left;">
						<img style="height: 32px; height: 32px; border-radius: 50%;" src="${user.getAvatarURL()}">			
						<div style="margin-left: 10px; margin-top: 5px">
							<span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
								${user.username}
							</span>
						</div>
					</div>
				</div>
				<div style="margin-left: 40px;">
					<div id="emojis" style="display: flex; flex-wrap: wrap; gap: 5px;">
					</div>
				</div>
			</div>`;

		const elem = BdApi.DOM.parseHTML(popoutHTML);


		currentObject.reactions.forEach(reaction => {
			Array.from(elem.querySelectorAll('div')).find(e => e.id == 'emojis').append(
				BdApi.DOM.parseHTML(`<div>${this.getReactionTextToDisplay(reaction)}</div>`)
			)
		});

		elem.addEventListener('click', () => { // object settings 
			const elements = [];
			const currentObjectReactions = Object.assign([], currentObject.reactions);

			const reactionsInput = this.createInput(this.labels.input_reactions, 'input_reactions', (e) => {

				const value = document.getElementById('input_reactions').value.trim();
				const table = document.getElementById('emojisToAdd');
				table.innerHTML = '';

				currentObjectReactions.forEach(reaction => {
					const textToDisplay = this.getReactionTextToDisplay(reaction);
					if (textToDisplay != '') {
						const reactionElement = BdApi.DOM.parseHTML(`<div>${this.getReactionTextToDisplay(reaction)}</div>`);
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

							const emojiQueryResult = BdApi.DOM.parseHTML(
								`<div style="height: 50px; margin-top: 10px; margin-bottom: 10px; display: flex; align-items: center;">						
								<div style="width: 50px;">${this.getReactionTextToDisplay(emoji)}</div>
								<div style="width: 100px; margin-left: 2%; color: white">:${emoji.name}:</div>
								${emoji.type == this.emojiType.custom ? `<div style="color: grey; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: right;">${this.getGuild(this.getCustomEmojiById(emoji.id).guildId).name}</div>` : ''}
							</div>`);

							emojiQueryResult.addEventListener('click', () => {
								if (!currentObjectReactions.some(e => this.isEqual(e, emoji))) { // if not already added
									currentObjectReactions.push(emoji);
									const reactionElement = BdApi.DOM.parseHTML(`<div>${this.getReactionTextToDisplay(emoji)}</div>`);
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


			const emojis = BdApi.DOM.parseHTML(
				`<div id="emojisToAdd" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px auto 10px;">
				</div>`
			)

			const emojisQueryList = BdApi.DOM.parseHTML('<div id="emojisQueryList"></div>');

			currentObject.reactions.forEach(reaction => {


				const textToDisplay = this.getReactionTextToDisplay(reaction);
				if (textToDisplay != '') {
					const reactionElement = BdApi.DOM.parseHTML(`<div>${textToDisplay}</div>`);
					reactionElement.addEventListener('click', (e) => {
						// delete 
						e.target.parentElement.outerHTML = ''; // order is important or parentElement will be undefined
						e.target.parentElement.innerHTML = '';

						currentObjectReactions.splice(currentObjectReactions.indexOf(reaction), 1);

					})
					emojis.append(reactionElement);
				}
			});



			const containingMethodText = BdApi.DOM.parseHTML(`<span style="color:#dddddd">${this.labels.containing_method_text}: </span>`);

			let currentContainingMethod = currentObject.method;
			const radioGroupOptions = {
				name: '',
				value: currentContainingMethod,
				options: [
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
				],
				onChange: (newMethod) => currentContainingMethod = newMethod
			};

			const containingMethodRadioGroup = BdApi.React.createElement(BdApi.Components.RadioInput, radioGroupOptions);

			elements.push(this.wrapElement(containingMethodText));

			elements.push(containingMethodRadioGroup);

			elements.push(this.wrapElement(emojis));

			elements.push(this.wrapElement(reactionsInput));


			elements.push(this.wrapElement(emojisQueryList));

			BdApi.UI.showConfirmationModal(this.labels.add_object_button, elements, {
				confirmText: this.labels.delete_object,
				cancelText: this.labels.save_settings,
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
									BdApi.DOM.parseHTML(`<div>${this.getReactionTextToDisplay(reaction)}</div>`)
								);
								currentObject.reactions.push(reaction);
							}
						});

					}

					currentObject.method = currentContainingMethod;
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
			const emoji = this.EmojiUtilitiesWebpack.getByName(reaction.name);
			if (emoji) {
				textToDisplay = `<img aria-label="${emoji.surrogates}" src="${this.getEmojiUrlFromSurrogate(emoji.surrogates)}" alt="${emoji.surrogates}" draggable="false" class="emoji jumboable" data-type="emoji"></img>`;
			}
		}
		else {
			const customEmoji = this.getCustomEmojiById(reaction.id);
			if (customEmoji) {
				textToDisplay = `<img aria-label=":${customEmoji.name}:" src=${this.getCustomEmojiUrl(customEmoji.id)} alt=":${customEmoji.name}:" draggable="false" class="emoji jumboable" data-type="emoji" data-id="${customEmoji.id}"></img>`;
			}
		}
		return textToDisplay;
	}

	renderUser(user) {
		const popoutHTML =
			`<div>
			<div style="margin-top: 10px; margin-bottom: 10px; display: flex; justify-content: left;">
				<img style="height: 32px; height: 32px; border-radius: 50%;" src="${user.getAvatarURL()}">			
				<span style="margin-left: 10px; margin-top: 5px">
					<span class="${this.UserTagConstants.defaultColor}" aria-expanded="false" role="button" tabindex="0">
						${user.username}
					</span>
					</span>
				<div id="confirmAdd" style="margin-right: 0px; margin-left: auto;"></div>
			</div>		
		</div>`;

		const elem = BdApi.DOM.parseHTML(popoutHTML);

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
		this.containedObjects = BdApi.Data.load(this.name, 'data');
		if (!this.containedObjects) {
			this.containedObjects = [];
		}
	}

	saveSettings() {
		BdApi.Data.save(this.name, 'data', this.containedObjects);
	}

	setLabelsByLanguage() {
		switch (BdApi.Webpack.getByKeys('getLocale')?.getLocale() || document.querySelector("html[lang]").getAttribute("lang")) {
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

	isEqual(a, b) {
		if (a === b) return a !== 0 || 1 / a === 1 / b;
		if (a == null || b == null) return false;
		if (a !== a) return b !== b;
		for (let key of Object.keys(a)) {
			if (!b[key] || a[key] != b[key]) {
				return false;
			}
		}
		return true;
	}

	stop() {
		console.log(`${this.name}: stopped!`);
		BdApi.Patcher.unpatchAll(this.name);
	}

}
