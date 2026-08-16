/*=============================================================================*
 * 내가본공시 쿠키세팅
 * 쿠키명 : krxDisc
 *============================================================================*/
function fnSetCookieDiscls(acptNo, title){
	var cookies		= GetCookie('krxDisc');
	var sCookieVal	= "";
	var isCookies	= false;
	
	if(cookies == undefined || cookies == "" ){
		sCookieVal = title+","+acptNo+"/";
	} 
	else {
		var j = 0;
		var items = cookies.split("/");
		var max = items.length;
		if(items.length > 10){
			max = 10;
		}
		for(var i=0;i<max; i++) {
			if(items[i] == ""){ continue; }
			sCookieVal = sCookieVal+"/"+items[i];
			j++;
			if(j > 10 ){ break; }
		}
		if(cookies.search(acptNo) < 0){isCookies = true;}
	}
	if(isCookies){
		sCookieVal = title+","+acptNo+"/"+sCookieVal;
	}
	SetCookie('krxDisc',sCookieVal ,'1');
}

/*=============================================================================*
 * 페이스북 SNS 공유연동
 *============================================================================*/
function facebook() 
{
	var url = document.location.href;
	var href = "http://www.facebook.com/sharer.php?u=" + encodeURIComponent(url);
	var win = window.open(href, 'facebook', '');
	if(win) win.focus();
}

/*=============================================================================*
 * 트위터 SNS 공유연동
 *============================================================================*/
function twitter()
{
	var form	= $("form[name=frm]");
	var msg		= $("#tempTitle", form).val();
	var url		= document.location.href;
	
	var href = "http://twitter.com/home?status=" + encodeURIComponent(msg) + " " + encodeURIComponent(url);
	var win = window.open(href, 'twitter', '');
	if(win) win.focus();
}

/*=============================================================================*
 * 목차영역 세팅
 *============================================================================*/
function fnTocInit()
{
	//iframe 투명
	$('#toc').attr("allowTransparency","true");
	$('section.toc-wrapper a.btn-close').bind('click',function(){
		$('section.toc-wrapper').addClass("hide");
		$('div.layer-opener-wrapper').addClass("active");
		$('div#doc').addClass("active");
		setTimeout("fnTocResize()", 100);
	});
	$('div.layer-opener-wrapper a.btn-open').bind('click',function(){
		$('section.toc-wrapper').removeClass("hide");
		$('div.layer-opener-wrapper').removeClass("active");
		$('div#doc').removeClass("active");
		setTimeout("fnTocResize()", 100);
	});
	
}

/*=============================================================================*
 * 공시본문 사이즈 설정
 *============================================================================*/
function fnTocResize()
{
	var tocTdWidth = $(".openToc").width()+25;
	var bh=$("body").height();
	var bw=$("body").width();
	var h=bh-205;
	
	$("#toc").height(h);
	$("#docViewFrm").height(h+28);
	$("#docViewFrm").width(bw-tocTdWidth);
	$('div.layer-opener-wrapper a.btn-open').height(h-61);
}

// --------------------------------------------------------------------------------
function search(docNo){
	document.docpathfrm.docNo.value = docNo;
	document.docpathfrm.submit();
}

//공시일자 셋팅
function setPubDD(selectObj){
	var val		= selectObj.options[selectObj.selectedIndex].text;
	var valLen	= val.length;
		val		= val.substring( valLen - 11, valLen - 1 );
	var tmpVal	= val.replace(".", "");
		tmpVal	= tmpVal.replace(".", "");
	
	var resultFlag = true;
	var c = '';
	for(var i=0 ; i<tmpVal.length ; i++){
		c = tmpVal.substring(i, i+1);
		if(c >= '0' && c <= '9'){
		}else{
			resultFlag = false;
		}
	}
	
	if(resultFlag){
		//document.getElementById("pubDate").innerHTML = val;
	}
}

/**
 * 2018.03.13 다운로드 기능 개선
 * 파일 다운로드 (PDF, Excel)
 */
/* (기존)
function filedownload(type){

	var agt=navigator.userAgent.toLowerCase();
	if(agt.indexOf("safari") != -1){
		alert("IE 브라우저에서만 지원 가능합니다.");
		return;
	}
	
	var fileurl = document.docdownloadform.docLocPath.value;
	var docpath = document.docdownloadform.docpath.value;
	
	filedownloadframe.document.location.href = "/disclsdocviewer/filedownload_jws_start.jsp?type=" + type + "&docpath=" + docpath;
}*/
function filedownload(type){
	if (type == "excel") {
		$("#docdownloadform > #method").val("searchDocExcel");
		$("#docdownloadform").attr('action', '/common/fileupload.do').submit();
	} else if (type == "pdf") {
		$("#docdownloadform > #method").val("searchDocPdf");
		$("#docdownloadform").attr('action', '/common/fileupload.do').submit();
	}
}

/*
 * 공시문서 출력
 * author : lds010
 * param :
 * param :
 */
function printDocument(){

	var sndLocTpCd		= document.frm.sndLocTpCd.value;
	var formUpclssCd	= document.frm.formUpclssCd.value;

	//금감원문서(송신처구분코드:20)인데 수시공시(서식대분류코드:01)가 아닐 경우 HTML 인쇄 기능을 제공하지 않는다.
	if(sndLocTpCd == "20" && formUpclssCd != "01"){
		//var flag = confirm("본 문서는 인쇄 기능을 지원하지 않습니다. PDF 다운로드 기능을 사용하시겠습니까?");
				
		//if(flag){
			var maindocFileNm = document.docdownloadform.docLocPath.value;
			if( maindocFileNm.indexOf("80752.htm") > -1 ) {
				pdfPrint("print");
			}else{
				fnPdfJson();
				//filedownload('pdf');
			}			
		//}
		return;
	}

	var docNo = document.docpathfrm.docNo.value;
	var url = "/common/disclsviewer.do?method=searchDocInfoForPrint&docNo=" + docNo;
	window.open(url,'공시문서출력','scrollbars=yes,toolbar=no,resizable=yes,status=yes,width=900,height=800,left=0,top=0');
}

/*
 * 2013.02.04 수시공시 사전확인절차면제 관련 추가
 * 경고문구 확인
 */
function doLayerPopup(v) {
	var layerPopupFull = document.getElementById("layerPopupFull");
	var layerPopup = document.getElementById("layerPopup");
	
	if( v == "show" ){
		layerPopupFull.style.display = '';
		layerPopup.style.display = '';
	}else{
		layerPopupFull.style.display = 'none';
		layerPopup.style.display = 'none';
	}
}

//단어찾기(기능지원보류)
var TRange=null
function findString (str) {
	if (parseInt(navigator.appVersion)<4) return;
	var strFound = 0;
    if(navigator.appName=="Netscape") {
		strFound=body.find(str);
		if(!strFound){
			strFound=body.find(str,0,1)
			while(body.find(str,0,1)){ continue; }
		}
	}
    // explorer
	if(navigator.appName.indexOf("Microsoft")!=-1) {
		if (TRange!=null) {
			TRange.collapse(false);
			strFound=TRange.findText(str);

			if(strFound){ TRange.select(); }
		}
		if (TRange==null || strFound==0) {
            try{
			    TRange=body.document.body.createTextRange();
            }catch(e){
                alert(e);
            }
			strFound=TRange.findText(str);
			if (strFound){ TRange.select(); }
		}
	}
	if(!strFound){
		alert (" '"+str+"' was not found in this page!");
	}
}

//단어찾기(기능지원보류)
function findText(){
	if(document.frm.findtf.value!=null && document.frm.findtf.value!=''){
		findString(document.frm.findtf.value);
	}
}

/*=============================================================================*
 * 도움말 새창
 *============================================================================*/
function openHelpWindow(){
	var url = "/help/help.html";
	window.open(url,'도움말','scrollbars=yes,toolbar=no,resizable=no,status=yes,width=750,height=720,left=100,top=100');
}

/*=============================================================================*
 * WINODW 닫기
 *============================================================================*/
function fnWinClose(){
	window.close();
}