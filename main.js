import { io } from "socket.io-client";

$(function () {
  const socket = io("https://chatx-backend.onrender.com");

  const FADE_TIME = 150;
  const TYPING_TIMER_LENGTH = 400;
  const COLORS = ['#e21400', '#91580f', '#f8a700', '#f78b00', '#58dc00', '#287b00', '#a8f07a', '#4ae8c4', '#3b88eb', '#3824aa', '#a700ff', '#d300e7'];

  const $usernameInput = $('.usernameInput');
  const $messages = $('.messages');
  const $inputMessage = $('.inputMessage');
  const $loginPage = $('.login.page');
  const $chatPage = $('.chat.page');
  const $leaveButton = $('.leaveButton');
  const $nextButton = $('.nextButton');
  const $okButton = $('.okButton');
  const $addMemberButton = $('.addMemberButton');
  const $memberModal = $('.memberModal');
  const $closeModal = $('.closeModal');
  const $themeToggle = $('.themeToggle');

  let username;
  let connected = false;
  let typing = false;
  let lastTypingTime;
  let $currentInput = $usernameInput.focus();

  // 🌗 Theme toggle
  $themeToggle.on('click', () => {
    $('body').toggleClass('light');
    $themeToggle.text($('body').hasClass('light') ? '🌞' : '🌙');
  });

  // ➕ Add Member Modal Logic
  $addMemberButton.on('click', () => {
    $memberModal.removeClass('hidden');
  });

  $closeModal.on('click', () => {
    $memberModal.addClass('hidden');
  });

  // 🎯 Add Member via prompt
  $(document).on('click', '.inviteOption', function () {
    const type = $(this).data('type');
    let promptText = "";

    switch (type) {
      case "phone": promptText = "Enter phone number:"; break;
      case "contacts": promptText = "Enter contact name or number:"; break;
      case "instagram": promptText = "Enter Instagram username:"; break;
      case "social": promptText = "Enter Facebook/Snapchat username:"; break;
      default: promptText = "Enter identifier:"; break;
    }

    const value = prompt(promptText);
    if (!value || !value.trim()) return;

    const payload = value.trim();
    if (type === "phone") socket.emit("invite_by_phone", { phone: payload });
    else if (type === "contacts") socket.emit("invite_by_contacts", { contact: payload });
    else if (type === "instagram") socket.emit("invite_by_instagram", { username: payload });
    else if (type === "social") socket.emit("invite_by_social", { platform: "social", username: payload });

    $memberModal.addClass("hidden");
  });

  const cleanInput = input => $('<div/>').text(input).html();

  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());
    if (!username) return alert("Please enter a nickname.");
    $loginPage.addClass('hidden');
    $chatPage.removeClass('hidden');
    $currentInput = $inputMessage.focus();
    socket.emit('add user', username);
    connected = true;
  };

  const sendMessage = () => {
    const message = cleanInput($inputMessage.val().trim());
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({ username, message });
      socket.emit('send_message', { username, message });
    }
  };

  const addChatMessage = (data, options = {}) => {
    const $typingMessages = getTypingMessages(data);
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    const $usernameDiv = $('<div class="username"/>').text(data.username).css('color', getUsernameColor(data.username));
    const $messageBodyDiv = $('<div class="messageBody"/>').text(data.message);
    const typingClass = data.typing ? 'typing' : '';

    const $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv)
      .append($messageBodyDiv);

    addMessageElement($messageDiv, options);
  };

  const log = (msg, options = {}) => {
    const $el = $('<li class="log">').text(msg);
    addMessageElement($el, options);
  };

  const addMessageElement = (el, options = {}) => {
    const $el = $(el);
    if (options.fade !== false) $el.hide().fadeIn(FADE_TIME);
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  };

  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing...';
    addChatMessage(data);
  };

  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  };

  const getTypingMessages = (data) =>
    $('.typing.message').filter(function () {
      return $(this).data('username') === data.username;
    });

  const getUsernameColor = (username) => {
    let hash = 7;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    return COLORS[Math.abs(hash % COLORS.length)];
  };

  const updateTyping = () => {
    if (connected && !typing) {
      typing = true;
      socket.emit('typing');
    }
    lastTypingTime = Date.now();

    setTimeout(() => {
      const timeDiff = Date.now() - lastTypingTime;
      if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
        socket.emit('stop typing');
        typing = false;
      }
    }, TYPING_TIMER_LENGTH);
  };

  $(window).keydown((event) => {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }

    if (event.which === 13) {
      if (connected) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', updateTyping);
  $loginPage.click(() => $currentInput.focus());
  $inputMessage.click(() => $inputMessage.focus());
  $nextButton.on('click', setUsername);
  $okButton.on('click', () => {
    if (connected) {
      sendMessage();
      socket.emit('stop typing');
      typing = false;
    }
  });

  $leaveButton.on('click', () => {
    $chatPage.addClass('hidden');
    $loginPage.removeClass('hidden');
    $usernameInput.val('');
    $inputMessage.val('').prop('disabled', false);
    $('.inputContainer').show();
    $currentInput = $usernameInput.focus();
    connected = false;

    const micButton = document.querySelector('.micButton');
    if (micButton) {
      micButton.disabled = false;
      micButton.classList.remove('active');
      micButton.textContent = '🎙';
    }

    log('You have left the chat. Please enter a nickname to rejoin.');
  });

  socket.on('login', (data) => {
    log('Welcome to ChattX', { prepend: true });
    log(`There ${data.numUsers === 1 ? "is" : "are"} ${data.numUsers} participant${data.numUsers !== 1 ? "s" : ""}`);
  });

  socket.on('receive_message', (msg) => {
    addChatMessage(msg);
  });

  socket.on('user joined', (data) => {
    log(`${data.username} joined`);
    log(`There are ${data.numUsers} participants`);
  });

  socket.on('user left', (data) => {
    log(`${data.username} left`);
    log(`There are ${data.numUsers} participants`);
    removeChatTyping(data);
  });

  socket.on('typing', addChatTyping);
  socket.on('stop typing', removeChatTyping);

  socket.on('disconnect', () => log('You have been disconnected'));
  socket.io.on('reconnect', () => {
    log('You have been reconnected');
    if (username) socket.emit('add user', username);
  });

  const micButton = document.querySelector('.micButton');
  if (micButton) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      micButton.addEventListener('click', () => {
        recognition.start();
        micButton.classList.add('active');
        micButton.textContent = '🎤';
      });

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        $inputMessage.val(transcript);
        $inputMessage.focus();
      };

      recognition.onend = () => {
        micButton.classList.remove('active');
        micButton.textContent = '🎙';
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micButton.classList.remove('active');
        micButton.textContent = '🎙';
      };
    } else {
      micButton.disabled = true;
      micButton.textContent = '🚫';
      console.warn('Speech Recognition API not supported in this browser.');
    }
  }
});
