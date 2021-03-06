// The ConversationPanel module is designed to handle
// all display and behaviors of the conversation column of the app.
/* eslint no-unused-vars: "off" */
/* global Api: true, Common: true*/

//Wait function
function wait(ms){
   var start = new Date().getTime();
   var end = start;
   while(end < start + ms) {
     end = new Date().getTime();
  }
}

//Data processing
var fake_rec_list = ["Dasani 24 pk purified water", "Chips Ahoy Chewey family size", "White Rice Basmati", "Sysco Whole Chicken Skinned", "Broccoli", "24 pack Cheddar Sandwich Slices", "24 OZ Tropicana Orange Juice", "Lays Family Size Potato Chips"];

function proc(context){
    context.action = "result_list";
    context.s_list = fake_rec_list;
    return context;
}

var fake_evidence_list = ["White Rice", "Chicken", "Broccoli"];
var fake_recipe_list = ["Casserole (American)", "Chicken Biryani (Indian)", "Chicken with Broccoli (Chinese)"];
function infer(context){
    context.action = "infer_success";
    context.e_list = fake_evidence_list;
    context.r_list = fake_recipe_list;
    return context;
}

var fake_missing_dict = {"casserole" : ["Mozzarella Cheese", "Butter", "Baking Powder"]};
function find_recipe_missing(context){
    var recipe = context.recipe;
    context.action = "miss_reci_found";
    context.rec_missing_list = fake_missing_dict[recipe];
    console.log("Chosen recipe: " + recipe);
    return context;
}



var ConversationPanel = (function() {
  var settings = {
    selectors: {
      chatBox: '#scrollingChat',
      fromUser: '.from-user',
      fromWatson: '.from-watson',
      latest: '.latest'
    },
    authorTypes: {
      user: 'user',
      watson: 'watson'
    }
  };

  // Publicly accessible methods defined
  return {
    init: init,
    inputKeyDown: inputKeyDown,
    sendMessage: sendMessage
  };

  // Initialize the module
  function init() {
    chatUpdateSetup();
    //Api.sendRequest('', null );
    setupInputBox();
  }
  // Set up callbacks on payload setters in Api module
  // This causes the displayMessage function to be called when messages are sent / received
  function chatUpdateSetup() {
    var currentRequestPayloadSetter = Api.setRequestPayload;
    Api.setRequestPayload = function(newPayloadStr) {
      currentRequestPayloadSetter.call(Api, newPayloadStr);
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.user);
    };

    var currentResponsePayloadSetter = Api.setResponsePayload;
    Api.setResponsePayload = function(newPayloadStr) {
      currentResponsePayloadSetter.call(Api, newPayloadStr);
      var json_msg = JSON.parse(newPayloadStr);
      console.log("check bw: " + json_msg.context.before_wait);
      console.log("check wait: " + json_msg.context.wait);
      if(json_msg.context.before_wait === true){
          console.log(" before wait");
          wait(4000);
      }
      displayMessage(JSON.parse(newPayloadStr), settings.authorTypes.watson);
      if(json_msg.context.wait === 'true'){
          console.log("wait");
          wait(4000);
      }        
      if (json_msg.context.action === 'prepare_list') {
            var new_msg = "processing";
            console.log("Start processing");
            json_msg.context = proc(json_msg.context);
            Api.sendRequest(null, json_msg.context);
      }
      else if(json_msg.context.action === 'infer_list'){
          var new_msg = "Inferring";
          clearList();
          displayList(json_msg.context.s_list);
          json_msg.context = infer(json_msg.context);
          Api.sendRequest(null, json_msg.context);
      }
      else if(json_msg.context.action === 'chosen_recipe'){
          var new_msg = "Find missing";
          console.log("Find missing");
          json_msg.context = find_recipe_missing(json_msg.context);
          Api.sendRequest(null, json_msg.context);
      }
      else if(json_msg.context.action === 'form_new_list'){
          clearList();
          var new_list = json_msg.context.s_list.concat(json_msg.context.rec_missing_list);
          displayList(new_list);
      }
    };
  }

// Set up the input box to underline text as it is typed
  // This is done by creating a hidden dummy version of the input box that
  // is used to determine what the width of the input text should be.
  // This value is then used to set the new width of the visible input box.
  function setupInputBox() {
    var input = document.getElementById('textInput');
    var dummy = document.getElementById('textInputDummy');
    var minFontSize = 14;
    var maxFontSize = 16;
    var minPadding = 4;
    var maxPadding = 6;

    // If no dummy input box exists, create one
    if (dummy === null) {
      var dummyJson = {
        'tagName': 'div',
        'attributes': [{
          'name': 'id',
          'value': 'textInputDummy'
        }]
      };

      dummy = Common.buildDomElement(dummyJson);
      document.body.appendChild(dummy);
    }

    function adjustInput() {
      if (input.value === '') {
        // If the input box is empty, remove the underline
        input.classList.remove('underline');
        input.setAttribute('style', 'width:' + '100%');
        input.style.width = '100%';
      } else {
        // otherwise, adjust the dummy text to match, and then set the width of
        // the visible input box to match it (thus extending the underline)
        input.classList.add('underline');
        var txtNode = document.createTextNode(input.value);
        ['font-size', 'font-style', 'font-weight', 'font-family', 'line-height',
          'text-transform', 'letter-spacing'].forEach(function(index) {
            dummy.style[index] = window.getComputedStyle(input, null).getPropertyValue(index);
          });
        dummy.textContent = txtNode.textContent;

        var padding = 0;
        var htmlElem = document.getElementsByTagName('html')[0];
        var currentFontSize = parseInt(window.getComputedStyle(htmlElem, null).getPropertyValue('font-size'), 10);
        if (currentFontSize) {
          padding = Math.floor((currentFontSize - minFontSize) / (maxFontSize - minFontSize)
            * (maxPadding - minPadding) + minPadding);
        } else {
          padding = maxPadding;
        }

        var widthValue = ( dummy.offsetWidth + padding) + 'px';
        input.setAttribute('style', 'width:' + widthValue);
        input.style.width = widthValue;
      }
    }

    // Any time the input changes, or the window resizes, adjust the size of the input box
    input.addEventListener('input', adjustInput);
    window.addEventListener('resize', adjustInput);

    // Trigger the input event once to set up the input box and dummy element
    Common.fireEvent(input, 'input');
  }

  // Display a user or Watson message that has just been sent/received
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
	
	
    var textExists = (newPayload.input && newPayload.input.text)
      || (newPayload.output && newPayload.output.text);
    if (isUser !== null && textExists) {
      // Create new message DOM element
      var messageDivs = buildMessageDomElements(newPayload, isUser);
      var chatBoxElement = document.querySelector(settings.selectors.chatBox);
      var previousLatest = chatBoxElement.querySelectorAll((isUser
              ? settings.selectors.fromUser : settings.selectors.fromWatson)
              + settings.selectors.latest);
      // Previous "latest" message is no longer the most recent
      if (previousLatest) {
        Common.listForEach(previousLatest, function(element) {
          element.classList.remove('latest');
        });
      }

      messageDivs.forEach(function(currentDiv) {
        chatBoxElement.appendChild(currentDiv);
        // Class to start fade in animation
        currentDiv.classList.add('load');
      });
      // Move chat to the most recent messages when new messages are added
      scrollToChatBottom();
    }
	
  }

  // Checks if the given typeValue matches with the user "name", the Watson "name", or neither
  // Returns true if user, false if Watson, and null if neither
  // Used to keep track of whether a message was from the user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === settings.authorTypes.user) {
      return true;
    } else if (typeValue === settings.authorTypes.watson) {
      return false;
    }
    return null;
  }

  // Constructs new DOM element from a message payload
  function buildMessageDomElements(newPayload, isUser) {
    var textArray = isUser ? newPayload.input.text : newPayload.output.text;
	
	
    if (Object.prototype.toString.call( textArray ) !== '[object Array]') {
      textArray = [textArray];
    }
    var messageArray = [];

    textArray.forEach(function(currentText) {
      if (currentText) {
        var messageJson = {
          // <div class='segments'>
          'tagName': 'div',
          'classNames': ['segments'],
          'children': [{
            // <div class='from-user/from-watson latest'>
            'tagName': 'div',
            'classNames': [(isUser ? 'from-user' : 'from-watson'), 'latest', ((messageArray.length === 0) ? 'top' : 'sub')],
            'children': [{
              // <div class='message-inner'>
              'tagName': 'div',
              'classNames': ['message-inner'],
              'children': [{
                // <p>{messageText}</p>
                'tagName': 'p',
                'text': currentText
              }]
            }]
          }]
        };
        messageArray.push(Common.buildDomElement(messageJson));
      }
    });

    return messageArray;
  }

  
  // function to display list of check boxes 
  function displayList(list)
  {
	  	 var container=document.getElementById('checkList');
		for(var x=0;x<list.length;x++){
            var checkbox = document.createElement('input');
            checkbox.type = "checkbox";
            checkbox.name = "wishList";
            checkbox.value = list[x];
            checkbox.id = "id_"+list[x];

            var label = document.createElement('label')
            label.htmlFor = "id_"+list[x];
            label.appendChild(document.createTextNode(list[x]));

            container.appendChild(checkbox);
            container.appendChild(label);
            var mybr = document.createElement('br');
            container.appendChild(mybr);

		}
  }
  
  
  //Function to clear list
  function clearList()
   {
      $("#checkList").empty();
   }
  
  
  // Scroll to the bottom of the chat window (to the most recent messages)
  // Note: this method will bring the most recent user message into view,
  //   even if the most recent message is from Watson.
  //   This is done so that the "context" of the conversation is maintained in the view,
  //   even if the Watson message is long.
  function scrollToChatBottom() {
    var scrollingChat = document.querySelector('#scrollingChat');

    // Scroll to the latest message sent by the user
    var scrollEl = scrollingChat.querySelector(settings.selectors.fromUser
            + settings.selectors.latest);
    if (scrollEl) {
      scrollingChat.scrollTop = scrollEl.offsetTop;
    }
  }

	// Retrieve the value of the input box
  function getMessage() {
    var userInput = document.getElementById('textInput');
    return userInput.value;
  }

  // Set the value of the input box
  function setMessage(text) {
    var userInput = document.getElementById('textInput');
    userInput.value = text;
    userInput.focus();
    Common.fireEvent(userInput, 'input');
  }
	function sendMessage(newText){
		var text;
	    if (newText) {
	      text = newText;
	    } else {
	      text = getMessage();
	    }
	    if (!text) {
	      return;
	    }
	    var context;
      	var latestResponse = Api.getResponsePayload();
      	if (latestResponse) {
        	context = latestResponse.context;
      	}

	    setMessage('');
	
	    Api.sendRequest(text, context);
	}
  // Handles the submission of input
  function inputKeyDown(event, inputBox) {
    // Submit on enter key, dis-allowing blank messages
    if (event.keyCode === 13 && inputBox.value) {
      // Retrieve the context from the previous server response
      var context;
      var latestResponse = Api.getResponsePayload();
      if (latestResponse) {
        context = latestResponse.context;
      }

      // Send the user message
      Api.sendRequest(inputBox.value, context);

      // Clear input box for further messages
      inputBox.value = '';
      Common.fireEvent(inputBox, 'input');
    }
  }
}());