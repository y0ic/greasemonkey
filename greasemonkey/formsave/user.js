// ==UserScript==
// @name        formsave
// @namespace   yoic
// @include     http://*
// @include     https://*
// @version     1
// @grant       GM_deleteValue
// @grant       GM_getValue
// @grant       GM_listValues
// @grant       GM_log
// @grant       GM_registerMenuCommand
// @grant       GM_setValue
// @require       http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// ==/UserScript==

function $xpath(element_node) {
    var NODE_TYPE_ELEMENT_NODE = 1;

    if (element_node instanceof Array) {
        element_node = element_node[0];
    }

    if (element_node.nodeType != NODE_TYPE_ELEMENT_NODE) {
    throw new ErrorException('nodes other than the element node was passed. node_type:'+ element_node.nodeType +' node_name:'+ element_node.nodeName);
    }

    var stacker = [];
    var node_name = '';
    var node_count = 0;
    var node_point = null;

    do {
        node_name = element_node.nodeName.toLowerCase();
        if (element_node.parentNode.children.length > 1) {
            node_count = 0;
            node_point = null;
            for (i = 0;i < element_node.parentNode.children.length;i++) {
                if (element_node.nodeName == element_node.parentNode.children[i].nodeName) {
                    node_count++;
                    if (element_node == element_node.parentNode.children[i]) {
                        node_point = node_count;
                    }
                    if (node_point != null && node_count > 1) {
                        node_name += '['+ node_point +']';
                        break;
                    }
                }
            }
        }
        stacker.unshift(node_name);
    } while ((element_node = element_node.parentNode) != null && element_node.nodeName != '#document');

    return '/' + stacker.join('/').toLowerCase();
}

// xpathを元にArray(Dom.Element)を取得
function $x(xpath, doc=window.document) {
  var nodes = doc.evaluate(xpath, doc, null, 
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  var data = new Array();
  for (var i = 0, len = nodes.snapshotLength; i < len; i++) {
        data.push(nodes.snapshotItem(i));
  }
  return data;
}

function $url(w = window.top){
    return w.location.protocol + "//" + w.location.hostname + w.location.pathname;
}

// function $documents(w = window.top){
//     var docs = new Array(w.document);

//     for(var i=0 ; i<w.frames.length; i++){
//         docs = docs.concat($documents(window.frames[i]));
//     }
    
//     return docs;
// }

function $windows(win){
    var wins = new Array(win);

    for(var i=0 ; i < win.frames.length; i++){
        wins = wins.concat(win.frames[i]);
    }
    
    return wins;
}

function getFormValues(){
    var result = new Object();
    var wins = $windows(this.window); 

    wins.forEach(function(w){
            result[$url(w)]=new Array();
            targets.forEach(function(target){
                var attr = target.attr;
                var xpathresult = new Array();
                var nodes = $x(target.xpath, w.document);
                
                for(var i=0 ; i < nodes.length ; i++){
                    var colum = {};
                    colum.SaveXPath = $xpath(nodes[i]);
                    colum.Attribute = attr;
                    colum.SaveValue = nodes[i][attr];
                    xpathresult.push(colum);
                }
                
                result[$url(w)]=result[$url(w)].concat(xpathresult);
            });
        }
    );

    return result;
}

// 記憶するDOM(XPATH)と属性セット
var targets = [   
    {
        xpath: '//select',
        attr: 'selectedIndex'
    },
    {
        xpath: '//input[@type="checkbox" or @type="radio"]',
        attr: 'checked'
    }, 
    {
        xpath: '//textarea | //input[@type="text"]',
        attr: 'value'
    },
];

//
// **Grease monkey のボタン追加
//
if (this.window.parent === this.window.top) {
    var gmkeys=GM_listValues();

    $(this.window).load(function(){
        GM_registerMenuCommand('Debugg(getFormValues)', function(){
            alert(JSON.stringify(getFormValues()));
        });

        // GM_registerMenuCommand('Debugg($windows)', function(){
        //     var urlstring = "";
        //     var wins=$windows(this.window);
         
        //     for(var i=0 ; i<wins.length ;i++){
        //         var elements = $x('//title', wins[i].document);
        //         if(elements.length > 0){
        //             urlstring = urlstring.concat($url(wins[i])+" "+$xpath(elements[0]) + "->" + elements[0].textContent +"\n");
        //         }
        //     }

        //     alert(urlstring);
        // });


        GM_registerMenuCommand('Save', function(){
            var name = this.window.prompt ('保存するフォームタイトルを入力してください。', 'test');
            if(name == null){
                alert("保存をキャンセルしました。");
            }else if(name==""){
                alert("フォームタイトルが空です。");
            }else{
                var value = GM_getValue(name);
                if(value == null){
                    var jsonstring = JSON.stringify(getFormValues());
                    //alert(jsonstring);
                    GM_setValue(name, jsonstring);
                    alert("保存が完了しました。");
                }else{
                    alert("同じ名前で既に保存済みのため保存できませんでした。");
                }
            }
            
        });

        //
        // **Grease monkey のLoadボタン追加
        //
        for(var key in gmkeys){
            GM_registerMenuCommand("Load<"+gmkeys[key]+">" , function(jsonstring=GM_getValue(gmkeys[key])){
                var jsonobj = JSON.parse(jsonstring);
                var wins = $windows(this.window); 

                for(var j=0 ; j < wins.length ; j++){
                    for(var i=0 ; i < jsonobj[$url(wins[j])].length ; i++){
                        var elements = $x(jsonobj[$url(wins[j])][i].SaveXPath, wins[j].document);
                        if(elements == null){
                            alert("このページでは使用できません\n\n" + $url(wins[j]));
                        }else{
                            if(elements.length != 1){
                                alert("Loadに一部失敗しました。Webページの構成が変更されています。" + "\n\nエラー："+jsonobj[$url(wins[j])][i].SaveXPath
                                +" Xpath:"+elements.length);
                            }else{
                                elements[0][jsonobj[$url(wins[j])][i].Attribute]=jsonobj[$url(wins[j])][i].SaveValue;
                            }
                        }
                    }
                }
            });
        }

        GM_registerMenuCommand('Delete', function(){
            var name = this.window.prompt ('削除するフォームタイトルを入力してください', 'xxx');
            if(name == null){
                alert("削除をキャンセルしましした");
            }else if(name==""){
                alert("フォームタイトルが空です");
            }else{
                var value = GM_getValue(name);
                
                if(value == null){
                    alert("該当のフォームタイトルが存在しませんでした。");
                }else{
                    GM_deleteValue(name);
                    alert(name+"の削除が完了しました。ページをリロードします。");
                    this.window.location.reload(true);
                }
            }
            
        });

        GM_registerMenuCommand('DeleteAll', function(){
            var flag = this.window.confirm ( "セーブデータを全て削除しますか？\n\n削除したくない場合は[キャンセル]ボタンを押して下さい。");
            if(flag){
                for(var key in gmkeys){
                    alert("delete:"+ gmkeys[key]);
                    GM_deleteValue(gmkeys[key]);
                }
                alert("削除が完了しました。ページをリロードします。");
                this.window.location.reload(true);
            }
        });
    });
}