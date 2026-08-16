/*=============================================================================*
 * 입력값이 숫자인지를 확인한다
 * param : sVal 입력스트링
 * return : Boolean True이면 숫자값
 *============================================================================*/
function isNumber(sVal)
{
  if(sVal.length < 1)
  {
  	return false;
  }
  for(i=0; i<sVal.length; i++)
  {
    iBit = parseInt(sVal.substring(i,i+1));     //문자(Char)를 숫자로 변경
    if(('0' < iBit) || ('9' > iBit))
    {
      //alert(i+':'+iBit+':'+'Mun');
    }
    else
    {
      return false;
    }
  }
  return true;
}
/*=============================================================================*
 * 입력값이 숫자인지를 확인하고 포멧을 만들어준다
 * param : sdateVal 입력스트링
 * return : Boolean True이면 숫자값
 *============================================================================*/
function chkDate(sdateVal){
  var dateVal = eval(sdateVal).value ;

  if(dateVal.length < 1)
  {
  	return ;
  }

  var dateVal2 = rtnNumber(dateVal);

  window.status = dateVal2.length ;
  if(dateVal2.length < 1)
  {
  	eval(sdateVal).value = "" ;
  }
  else if(dateVal2.length >= 1 && dateVal2.length < 8){

     eval(sdateVal).value = dateVal2 ;
  }
  else if(dateVal2.length == 8){
      eval(sdateVal).value = dateVal2.substring(0,4)+"-"+dateVal2.substring(4,6)+"-"+dateVal2.substring(6,8) ;
  }
  else if(dateVal2.length > 8){
    eval(sdateVal).value = dateVal2.substring(0,4)+"-"+dateVal2.substring(4,6)+"-"+dateVal2.substring(6,8) ;
  }
}
/*
	내    용 : 일자값 체크 (8문자 수치여부, 년월일값의 범위, 윤년)
	파라미터 : pDate - 체크할 날짜
	Return값 : TRUE or FALSE
*/
function fCheckDate(pDate2)
{
   // 일자값 저장 배열
   var vDateArray = new Array(3);
	// 값이 없으면 false 리턴
	if(pDate2 == "")
	{

		return false;
	}

	var pDate = rtnNumber(pDate2);
	// 값이 없으면 false 리턴
	if(pDate == "")
	{

		return false;
	}
	// 길이가 8 이 아니면 false 리턴
	if(pDate.length != 8)
	{

		return false;
	}

	// 길이대로(년:4, 월:2, 일:2) 잘라서 배열에 저장
	vDateArray[0] = pDate.substring(0,4);
	vDateArray[1] = pDate.substring(4,6);
	vDateArray[2] = pDate.substring(6,8);


	// 년도값이 0 부터 9999 사이의 수치가 아니면 false 리턴
	if(eval(vDateArray[0]) < 0 || eval(vDateArray[0]) > 9999)
	{

		return false;
	}

	// 월값이 1 부터 12 사이의 수치가 아니면 false 리턴
	if(eval(vDateArray[1]) < 1 || eval(vDateArray[1]) > 12)
	{

		return false;
	}

	// 일값이 1 부터 31 사이의 수치가 아니면 false 리턴
	if(eval(vDateArray[2]) < 1 || eval(vDateArray[2]) > 31)
	{

		return false;
	}

	// 월값이 길이가 1 이면 앞에 "0" 을 붙인다
	if(vDateArray[1].length == 1) vDateArray[1] = "0" + vDateArray[1];

	// 일값이 길이가 1 이면 앞에 "0" 을 붙인다
	if(vDateArray[2].length == 1) vDateArray[2] = "0" + vDateArray[1];

	// 30 일까지 있는 달의 일 체크
	if((eval(vDateArray[1]) == 4 || eval(vDateArray[1]) == 6 || eval(vDateArray[1]) == 9 || eval(vDateArray[1]) == 11) && eval(vDateArray[2]) == 31)
	{
				return false;
	}

	// 윤년일 경우
	if(((eval(vDateArray[0]) % 4 == 0 && eval(vDateArray[0]) % 100 != 0) || eval(vDateArray[0]) % 400 == 0))
	{
		// 2 월의 일 체크
		if(eval(vDateArray[1]) == 2 && eval(vDateArray[2]) > 29)
		{

			return false;
		}
	}
	// 윤년이 아닐 경우
	else
	{
		// 2월의 일 체크
		if(eval(vDateArray[1]) == 2 && eval(vDateArray[2]) > 28)
		{

			return false;
		}
	}

	return true;
}
/*=============================================================================*
 * 날짜컬럼에 포커스들어갈경우 "-" 제거해준다
 * param : sdateVal 입력스트링
 * return : Boolean True이면 숫자값
 *============================================================================*/
function cal_offMask(sdateVal){

  var dateVal = eval(sdateVal).value ;
  if(dateVal.length < 1)
  {
    return false;
  }

  //eval(sdateVal).value = "";
  //eval(sdateVal).value = dateVal.replace(/\-/g, '');
 }
/*=============================================================================*
 * 입력값이 숫자인지를 확인한다
 * param : sVal 입력스트링
 * return : Boolean True이면 숫자값
 *============================================================================*/

function rtnNumber(sVal)
{
  var rtnVal = "";
  if(sVal.length < 1)
  {
  	return rtnVal;
  }
  for(i=0; i<sVal.length; i++)
  {
    iBit = parseInt(sVal.substring(i,i+1));     //문자(Char)를 숫자로 변경
    if(('0' <= iBit) && ('9' >= iBit))
    {
      rtnVal = rtnVal + iBit;
    }
  }
  return rtnVal;
}
/*=============================================================================*
 * 입력값이 숫자인지를 확인한다. (' '까지 괜찮음)
 * param : sVal 입력스트링
 * return : Boolean True이면 숫자값
 *============================================================================*/
function isNumberSpace(sVal)
{
  if(sVal.length < 1)
  {
    return false;
  }

  for(var i=0;i<sVal.length;i++)
    {
      sBitData = sVal.substring(i,i+1);     //문자열의 문자(char)를 넣는다
      if(sBitData == ' ')
      {
      }
      else
      {
        iBit = parseInt(sVal.substring(i,i+1)); //문자(char)를 숫자로
        if(('0' < iBit) || ('9' > iBit) || (' ' == sBitData))
        {
        }
        else
        {
		  return false;
        }
      }
    }
  return true;
}
/*=============================================================================*
 * sVal 값이 숫자인지를 확인한다.('.'까지 괜찮음)
 *
 * param : sVal 입력스트링
 *
 * return : Boolean  True이면 숫자값
 *============================================================================*/
function isNumberDot(sVal)
{
	if (sVal.length < 1) {
	    return false;
	}

	var result=0;
	var position=0;
	var bMinus;
	//마이너스 부호의 갯수를 카운트하여 올바른지 확인
	for(position=0; position<sVal.length; position++)
	{
	    if( getAt(sVal, position) == '-' )
 	    {
			result += 1;
	    }
	}
	if(result > 1)
	    return false;

	result = 0;
	//소수점의 갯수를 카운트하여 올바른지 확인
	for(position=0; position<sVal.length; position++)
	{
	    if( getAt(sVal, position) == '.' )
 	    {
			result += 1;
	    }
	}
	if(result > 1)
	    return false;
	//마이너스 부호를 가지고 있는지 확인. 있다면 부호는 빼낸다.
	if(sVal.substr(0,1) == '-')
	{
	    bMinus = true;
	    sVal = sVal.substring(1, sVal.length);
	}
	//맨앞에 소수점이 있거나 맨 뒤에 있을 경우 0 을 추가해 줌.
	if(sVal.substring(0,1) == '.')
	    sVal = '0' + sVal;
	else if(sVal.substring(sVal.length-1,sVal.length) == '.')
	    sVal = sVal + '0';

	//검사.
	for(var position=0; position<sVal.length; position++)
	{
	    if( (getAt(sVal, position) < '0' || getAt(sVal, position) >'9') && getAt(sVal,position) != '.' )
			return false;
	}
    return true;
}
function getAt(sVal, position)
{
	return sVal.substring(position, position+1)
}
/*=============================================================================*
 * 앞자리의 연속된 Zero 값을 자른다.
 * param : sVal 입력스트링
 * return : String  Zero값을 자른 값
 *============================================================================*/
function trimZero(sVal)
{
  var i;
  i = 0;
  while (sVal.substring(i,i+1) == '0')
  {
    i++;
  }
  return sVal.substring(i);
}
/*=============================================================================*
 * 입력값의 앞에 정해진 자리수만큼 0을 채운다.
 * param : sVal 입력스트링, iSize
 * return : String
 *============================================================================*/
function fillZero(sVal, iSize)
{
    while(sVal.length < iSize)
    {
		sVal = "0" + sVal;
    }
	return sVal;
}
/*=============================================================================*
 * 길이가1인 경우 앞에 "0"을 붙인다.
 *
 * param : sVal 입력스트링
 *
 * return : String  "0"값을 포함하는 값
 *============================================================================*/
function addZero(sVal)
{
  var iLen = sVal.length;   //인수값의 길이를 구한다.
  if(iLen == 1)
  {
    sVal = "0"+sVal;
  }
  else if(iLen == 0)
  {
    return;
  }
  return sVal;
}
/*=============================================================================*
 * 날짜 여부를 확인한다.(월일 or 년월 or 년월일)
 *
 * param : sYmd 입력스트링(MMDD or YYYYMM or YYYYMMDD)
 *
 * return : Boolean true이면 날짜 범위임
 *
 * 수정   : 월이나 일에 00 입력시 스크립트 에러. trimZero 부분을 수정(2003/11/19)
 *============================================================================*/
function isDate(sYmd)
{
  var bResult;  // 결과값을 담는 변수(Boolean)
  switch (sYmd.length)
  {
    case 4://월일
      bResult = isDateMD(sYmd);
      break;
    case 6://년월
      bResult =  isDateYM(sYmd);
      break;
    case 8://년월일
      bResult =  isDateYMD(sYmd);
      break;
    default:
      bResult = false;  // 날짜 값이 아님
      break;
  }
  return bResult;
}
/*=============================================================================*
 * 날짜 여부를 확인한다.(년월일)
 *
 * param : sYmd 입력스트링(YYYYMMDD)
 *
 * return : Boolean true이면 날짜 범위임
 *============================================================================*/
function isDateYMD(val)
{
	var sYmd = val.value.replace(/\-/g, '');
  // 길이 확인      //@@ 12.5 순서 변경
  if(sYmd.length > 0){
	  if(sYmd.length != 8)
	  {
		alert('일자를 모두 입력하십시오');
		return false;
	  }
	  // 숫자 확인
	  if(!isNumber(sYmd))
	  {
		alert('날짜는 숫자만 입력하십시오');
		return false;
	  }
	  var iYear = parseInt(sYmd.substring(0,4),10);  // 년도 입력(YYYY)
	  var iMonth = parseInt(sYmd.substring(4,6),10);   //월입력(MM)
	  var iDay = parseInt(sYmd.substring(6,8),10);     //일자입력(DD)
	  if((iMonth < 1) ||(iMonth >12))
	  {
		alert(iMonth+'월의 입력이 잘못 되었습니다.');
		val.value = "";
		return false;
	  }

	  //각 달의 총 날수를 구한다
	  var iLastDay = lastDay(sYmd.substring(0,6));  // 해당월의 마지말날 계산
	  if((iDay < 1) || (iDay > iLastDay))
	  {
		alert(iMonth+'월의 일자는 1 - '+ iLastDay +'까지입니다.');
		val.value = "";
		return false;
	  }
	  val.value = sYmd.substr(0,4)+"-"+sYmd.substr(4,2)+"-"+sYmd.substr(6,2);
  }
  return true;
}
/*=============================================================================*
 * 포커스가 들어가면 데이터 클리어
 *
 * param : vla 입력스트링(Object)
 *
 * return : -를 뺀 문자열로 return
 *============================================================================*/
function dataDel(obj){
  obj.val(obj.val().replace(/\-/g, ''));
}
/*=============================================================================*
 * 날짜 여부를 확인한다.(월일)
 *
 * param : sMD 입력스트링(MMDD)
 *
 * return : Boolean true이면 날짜 범위임
 *============================================================================*/
function isDateMD(sMD)
{
  // 숫자 확인
  if(!isNumber(sMD))
  {
    alert('숫자만 입력하십시오');
    return false;
  }
  // 길이 확인
  if(sMD.length != 4)
  {
    alert('일자를 모두 입력하십시오');
    return false;
  }
  var iMonth = parseInt(sMD.substring(0,2),10);  //해당월을 숫자값으로
  var iDay = parseInt(sMD.substring(2,4),10);    //해당일을 숫자값으로
  if((iMonth < 1) ||(iMonth >12))
  {
    alert(iMonth+'월의 입력이 잘못 되었습니다.');
    return false;
  }

  //각 달의 총 날수를 구한다
  if (iMonth < 8 )
   {
	var iLastDay = 30 + (iMonth%2);
   }
  else
   {
	var iLastDay = 31 - (iMonth%2);
   }
  if (iMonth == 2)
  {
    iLastDay = 29;
  }

  if((iDay < 1) || (iDay > iLastDay))
  {
    alert(iMonth+'월의 일자는 1 - '+iLastDay+'까지입니다.');
    return false;
  }
  return true;
}
/*=============================================================================*
 * 날짜 여부를 확인한다.(년월)
 *
 * param : sYM 입력스트링(YYYYMM)
 *
 * return : Boolean true이면 날짜 범위임
 *============================================================================*/
function isDateYM(sYM)
{
  // 숫자 확인
  if(!isNumber(sYM))
  {
    alert('날짜는 숫자만 입력하십시오');
    return false;
  }
  // 길이 확인
  if(sYM.length != 6)
  {
    alert('일자를 모두 입력하십시오');
    return false;
  }

  var iYear = parseInt(sYM.substring(0,4),10); //년도값을 숫자로
  var iMonth = parseInt(sYM.substring(4,6),10);  //월을 숫자로

  if((iMonth < 1) ||(iMonth >12))
  {
    alert(iMonth+'월의 입력이 잘못 되었습니다.');
    return false;
  }
  return true;
}

/*=============================================================================*
 * 년월을 입력받아 마지막 일를 반환한다(년월)
 *
 * param : sYM 입력스트링(YYYYMM)
 *
 * return : String 해당월의 마지막날
 *============================================================================*/
function lastDay(sYM)
{
  if(sYM.length != 6)
  {
    alert("정확한 년월을 입력하십시오.");
    return;
  }

  if(!isDateYM(sYM))
  {
     return;
  }

  daysArray = new makeArray(12);    // 배열을 생성한다.
  for (i=1; i<8; i++)
  {
    daysArray[i] = 30 + (i%2);
  }
  for (i=8; i<13; i++)
  {
    daysArray[i] = 31 - (i%2);
  }
  var sYear = sYM.substring(0, 4) * 1;
  var sMonth	= sYM.substring(4, 6) * 1;

  if (((sYear % 4 == 0) && (sYear % 100 != 0)) || (sYear % 400 == 0))
  {
		daysArray[2] = 29;
  }
  else
  {
		daysArray[2] = 28;
  }

  return daysArray[sMonth].toString();
}
/*=============================================================================*
 * 대소문자를 포함한 영문자인지 확인한다.
 *
 * param : sVal 입력문자열
 *
 * return : Boolean true이면 알파벳
 *============================================================================*/
function isAlpha(sVal)
{
  // Alphabet 값
  var sAlphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var iLen=sVal.length;   //입력값의 길이
  for(i=0;i<iLen;i++)
  {
    if(sAlphabet.indexOf(sVal.substring(i,i+1))<0)
    {
      alert("허용된 문자가 아닙니다.\n영문으로 입력해 주세요.");
      return false;
    }
  }
  return true;
}
/*=============================================================================*
 * 영문자와 숫자 구성된 문자열인지 확인
 *
 * param : sVal 입력문자열
 *
 * return : Boolean true이면 영문자,숫자로 구성된 문자열
 *============================================================================*/
function isAlphaNumeric(sVal)
{
  var sAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  var iLen      = sVal.length;
  for ( i = 0; i < iLen; i++ )
  {
    if ( sAlphabet.indexOf(sVal.substring(i, i+1)) < 0 )
    {
      return false;
    }
  }
  return true;
}
/*=============================================================================*
 * 문자열의 길이를 return (한글:2자)
 *
 * param : sVal 입력문자열
 *
 * return : int 입력문자열의 길이
 *============================================================================*/
function strLength(sVal)
{
  var sBit = '';    // 문자열의 문자(Char)
  var iLen = 0; //문자열 길이
  for ( i = 0 ; i < sVal.length ; i++ )
  {
    sBit = sVal.charAt(i);
    if ( escape( sBit ).length > 4 )
    {
      iLen = iLen + 2;
    }
	else
	{
      iLen = iLen + 1;
    }
  }
  return iLen;
}
/*=============================================================================*
 * 문자열 길이 체크
 * param : str 필드객체, field 필드명
 * return : boolean
 *============================================================================*/
function chkStrLength(str,field)
{
	iSize = str.getAttribute("Maxlength")
	if (field == null)
		field = '';
	if ( strLength(str.value) > iSize)
	{
//		if (flag=1)
			alert("입력가능한 "+field+" 최대길이는 영문/숫자일 때 "+iSize+"자, 한글일 때 "+Math.floor(iSize/2)+"자입니다.");
//		else
//			alert(field+" 최대길이는 "+iSize+"자 입니다.");
        str.select();
	    str.focus();
		return false;
	}
	return true;
}

/*=============================================================================*
 * 한글이지 여부 체크
 *
 * param : sVal 입력문자열
 *
 * return : Boolean true이면 한글
 *============================================================================*/
function isHangul(sVal)
{
  var sBit = '';
  for(i=0;i<sVal.length;i++)
  {
    sBit = sVal.charAt(i);
    if(escape( sBit ).length <= 4)
    {
	  alert("한글만 입력하십시오.");
      return false;
    }
  }
  return true;
}
/*=============================================================================*
 * 주민등록 여부를 확인한다.(내국인)
 *
 * param : sID 입력문자열(주민번호 13자리)
 *
 * return : Boolean true이면 적합한 주민번호
 *============================================================================*/
function isSocialNO(ssn)
{
	var digit=0
    for (var i=0 ; i<ssn.length ; i++){
        var str_dig=ssn.substring(i,i+1);
        if (str_dig<'0' || str_dig>'9'){
            digit=digit+1
        }
    }
    if(digit>0)
    {
        return false;
    }

    var year   = parseInt(ssn.substring(0,2));
    var month  = parseInt(ssn.substring(3,4));
    var day    = parseInt(ssn.substring(5,6));
    var gender = parseInt(ssn.substring(7,7));
    var local  = parseInt(ssn.substring(8,11));
    var key    = parseInt(ssn.substring(12));

    if( (month<0) || (month>12) )
    {
        return false;
    }

    if( (month==1) || (month==3) || (month==5) || (month==7) || (month==8) || (month==10) || (month==12) )
    {
        if( (day<0) || (day>31) )
        {
            return false;
        }
    }
    if( (month==4) || (month==6) || (month==9) || (month==10) )
    {
        if( (day<0) || (day>30) )
        {
            return false;
        }
    }

    if(month==2)
    {
        if( (year==0) && ( (gender==1) || (gender==2) ) )
        {
            if( (day<0) || (day>28) )
            {
                return false;
            }
        }
        else if( (year==0) && ( (gender==3) || (gender==4) ) )
        {
            if( (day<0) || (day>29) )
            {
                return false;
            }
        }
        else if(year%4==0)
        {
            if( (day<0) || (day>29) )
            {
                return false;
            }
        }
        else
        {
            if( (day<0) || (day>28) )
            {
                return false;
            }
        }
    }
    if( (gender<0) || (gender>4) )
    {
        return false;
    }
    cBit = 0;
    sCode="234567892345";
    for(i=0;i<12;i++)
    {
        cBit = cBit+parseInt(ssn.substring(i,i+1))*parseInt(sCode.substring(i,i+1));
    }
    cBit=11-(cBit%11);
    cBit=cBit%10;
    if(key!=cBit)
    {
		return false;
    }
    else
    {
        return true;
    }
}
/*=============================================================================*
 * 주민등록 여부를 확인한다.(외국인)
 *
 * param : sID 입력문자열(주민번호 13자리)
 *
 * return : Boolean true이면 적합한 주민번호
 *============================================================================*/
function isFgnSocialNO(ssn) {
	if ((ssn.charAt(6) == "5") || (ssn.charAt(6) == "6"))
	{
	   birthYear = "19";
	}
	else if ((ssn.charAt(6) == "7") || (ssn.charAt(6) == "8"))
	{
	   birthYear = "20";
	}
	else if ((ssn.charAt(6) == "9") || (ssn.charAt(6) == "0"))
	{
	   birthYear = "18";
	}
	else
	{
	  return false;
	}

	birthYear += ssn.substr(0, 2);
	birthMonth = ssn.substr(2, 2) - 1;
	birthDate = ssn.substr(4, 2);
	birth = new Date(birthYear, birthMonth, birthDate);

	if ( birth.getYear() % 100 != ssn.substr(0, 2) ||
		 birth.getMonth() != birthMonth ||
		 birth.getDate() != birthDate) {

	  return false;
	}
    var sum = 0;
    var odd = 0;

    buf = new Array(13);
    for (i = 0; i < 13; i++) buf[i] = parseInt(ssn.charAt(i));
    odd = buf[7]*10 + buf[8];

    if (odd%2 != 0) {
      return false;
    }
    if ((buf[11] != 6)&&(buf[11] != 7)&&(buf[11] != 8)&&(buf[11] != 9)) {
      return false;
    }

    multipliers = [2,3,4,5,6,7,8,9,2,3,4,5];
    for (i = 0, sum = 0; i < 12; i++) sum += (buf[i] *= multipliers[i]);
    sum=11-(sum%11);

    if (sum>=10) sum-=10;
    sum += 2;
    if (sum>=10) sum-=10;
    if ( sum != buf[12]) {
        return false;
    }
    else {
        return true;
    }
}
/*=============================================================================*
 * 입력받은 날짜로부터 몇일 후의 날짜를 반환하기
 *
 * param : ObjDate객체, 일수, 결과Data객체
 *
 * return :
 *============================================================================*/
function calcDate(objDate,iDay,objResultDate)
{
  //기존 코드 주석처리
  /*
  daysArray = new makeArray(12); //월별 공간을 생성

  for(i=1; i<13; i++)
  {
    daysArray[i] = 30 + (i%2);
  }

  var sYear  	= objDate.value.substring(0, 4) * 1;
  var sMonth 	= objDate.value.substring(4, 6) * 1;
  var sDay   	= objDate.value.substring(6, 8) * 1;

  daysArray[2] = lastDay(sYear + "02");

  var iMoveRemain = iDay * 1 + sDay;
  var iCurMonth   = sMonth;
  var iCurYear    = sYear;

  while (iMoveRemain > daysArray[iCurMonth])
  {
    iMoveRemain = iMoveRemain - daysArray[iCurMonth];

    iCurMonth = iCurMonth + 1;
    if (iCurMonth > 12)
    {
      iCurMonth = 1;
      iCurYear = iCurYear + 1;
      daysArray[2] = lastDay(iCurYear + "02");
    }
  } //end of while

  iCurMonth = addZero(iCurMonth.toString());
  iMoveRemain = addZero(iMoveRemain.toString());

  objResultDate.value = iCurYear + iCurMonth + iMoveRemain;
  */

  //박시형 과장님 수정
  daysArray = new makeArray(12); //월별 공간을 생성

  for(i=1; i<8; i++)
  {
    daysArray[i] = 30 + (i%2);
  }
  for(i=8; i<13; i++)
  {
    daysArray[i] = 31 - (i%2);
  }
  var sYear  	= objDate.value.substring(0, 4) * 1;
  var sMonth 	= objDate.value.substring(4, 6) * 1;
  var sDay   	= objDate.value.substring(6, 8) * 1;

  daysArray[2] = lastDay(sYear + "02");

  var iMoveRemain = iDay * 1 + sDay;
  var iCurMonth   = sMonth;
  var iCurYear    = sYear;
  if(iMoveRemain > 0)
  {
	  while (iMoveRemain > daysArray[iCurMonth])
	  {
	    iMoveRemain = iMoveRemain - daysArray[iCurMonth];

	    iCurMonth = iCurMonth + 1;
	    if (iCurMonth > 12)
	    {
	      iCurMonth = 1;
	      iCurYear = iCurYear + 1;
	      daysArray[2] = lastDay(iCurYear + "02");
	    }
	  } //end of while
  }
  else
  {
	  while (iMoveRemain < 1)
	  {
	    iCurMonth = iCurMonth - 1;
	    if (iCurMonth == 0)
	    {
	      iCurMonth = 12;
	      iCurYear = iCurYear - 1;
	      daysArray[2] = lastDay(iCurYear + "02");
	    }
	    iMoveRemain = iMoveRemain + daysArray[iCurMonth];
	  } //end of while
  }
  iCurMonth = addZero(iCurMonth.toString());
  iMoveRemain = addZero(iMoveRemain.toString());

  objResultDate.value = iCurYear + iCurMonth + iMoveRemain;
}
/*=============================================================================*
 * 숫자 0으로 초기화 된 1차원 배열을 생성한다.
 *
 * param : iSize 배열 크기
 *
 * return : this 배열
 *============================================================================*/
function makeArray(iSize)
{
  this.length = iSize;
  for (i = 1; i <= iSize; i++)
  {
    this[i] = 0;
  }
  return this;
}
/*=============================================================================*
 * 숫자 분리자(,)(.)가 있는 숫자이거나 일반숫자형태인지 검사한다.
 *
 * param : sVal
 *
 * return : Boolean
 *============================================================================*/
function isMoneyNumber(sVal)
{
  var iAbit;

  if (sVal.length < 1) return true;
  for (i=0; i<sVal.length; i++)
  {
    iAbit = parseInt(sVal.substring(i,i+1));
    if (!(('0' < iAbit) || ('9' > iAbit)))
    {
      if (sVal.substring(i, i+1) == ',' || sVal.substring(i, i+1) == '.' )
      {
      }
      else
      {
        return false;
      }
    }
  }
  return true;
}
/*=============================================================================*
 * 숫자 분리자(,)만 있는 숫자이거나 일반숫자형태인지 검사한다.
 *
 * param : sVal
 *
 * return : Boolean
 *============================================================================*/
function isMoneyNumber2(sVal)
{
  var iAbit;

  if (sVal.length < 1) return true;
  for (i=0; i<sVal.length; i++)
  {
    iAbit = parseInt(sVal.substring(i,i+1));
    if (!(('0' < iAbit) || ('9' > iAbit)))
    {
      if (sVal.substring(i, i+1) == ',')
      {
      }
      else
      {
        return false;
      }
    }
  }
  return true;
}
/*=============================================================================*
 * 숫자 분리자(.)만 있는 숫자이거나 일반숫자형태인지 검사한다.
 * param : sVal
 * return : Boolean
 *============================================================================*/
function isMoneyNumber3(sVal)
{
  var iAbit;
  var deci_cnt = 0;
  if (sVal.length < 1) return true;
  for (i=0; i<sVal.length; i++)
  {
    iAbit = parseInt(sVal.substring(i,i+1));
    if (!(('0' < iAbit) || ('9' > iAbit)))
    {
      if (sVal.substring(i, i+1) == '.' )
      {
		  deci_cnt = deci_cnt + 1;//소수점 이하가 있는지 파악 (1이면 소수점 이하 존재)
      }
      else
      {
        return false;
      }
    }
  }
  if (deci_cnt > 1)
  {
	  return false;
  }
  return true;
}
/*=============================================================================*
 * 숫자 분리자(.)만 있는 숫자인지 검사한다.
 *
 * param : sVal
 *
 * return : Boolean
 *============================================================================*/
function isMoneyNumber4(sVal){
  var deci_cnt = 0;
  for (i=0; i<sVal.length; i++)
  {

      if (sVal.substring(i, i+1) == '.' ){
		  deci_cnt = deci_cnt + 1;//소수점있는지여부
      }

  }
  if (deci_cnt > 0)
  {
	  return true;
  }
  return false;
}
/*=============================================================================*
 * 소수점이 있는 숫자이면서 정해진 자릿수에 맞는 형식인지 확인한다.
 * param : sVal 입력객체, iSize1 정수자릿수, iSize2 소수자릿수
 * return : boolean
 *============================================================================*/
function isMoneyNumber5(sVal, iSize1, iSize2)
{
	if(isMoneyNumber(sVal))		// ,나 .가 들어가는 숫자인지 확인
	{
		var e = sVal.value;
		e = e.split(".");
	    e[0] = numOffMask(e[0]);
		if (!e[1]) {
			e[1] = 0;
		}

		var aVal = e[0] + "." + e[1];
		if (isNumberDot(aVal)) {
			// 입력된 값이 설정된 정수자릿수 또는 소숫점 이하보다 크면 false
			if (e[0].length > iSize1 || e[1].length > iSize2)
				return false;
			else
				return true;
		}
		else {
		    return false;
		}
	}
	else {
		return false;
	}
}

/*=============================================================================*
 * 소수점 숫자표현(소수점 위의 3자리마다 "," 맞춤)
 * param : val
 *
 * return : String
 *============================================================================*/
function getMoneyType(val)
{
  if (typeof val == "number")
  {
    val = val.toString();
  }

  var value = getOnlyNumberDot(val);

  var sResult = "";
  if (value.length == 0)
  {
    alert("숫자만 입력하십시오.");
    return;
  }
  if (! isMoneyNumber(value))
  {
    alert("숫자만 입력하십시오.");
    return;
  }

  var nI;
  var nJ = -1;
  var subOne;
  var flag = false;
  for (nI = value.length - 1; nI >= 0; nI--)
  {
    subOne = value.substring(nI, nI + 1);
    sResult = subOne + sResult;
	if (subOne == '.')
	{
		flag = true;
	}
	if (flag == true)
	{
		nJ = nJ + 1;
	}
    if ((nJ % 3 == 0) && (nI != 0) && (nJ != 0))
    {
      sResult = "," + sResult;
    }
  }
  return sResult;
}
/*=============================================================================*
 * 부호가 있는 소수점 숫자표현(소수점 위의 3자리마다 "," 맞춤)
 *
 * param : val
 *
 * return : String
 *============================================================================*/
function getSignMoneyType(val)
{
  if (typeof val == "number")
  {
	 val = val.toString();
  }
  var s1	= val.substring(0,1);
  var slen	= val.length;
  var sign	= "";
  var ret		= "";
  if (val == "-Infinity")
  {
		return "0";
  }

  if(slen>1 )
  {
    if(s1 == "-")
    {
      sign = "-";
      ret = sign + getMoneyType(val.substring(1,slen));
     }
     else
     {
       ret = getMoneyType(val);
     }
   }
   else
   {
     ret = val;
   }
   return  ret;
}
/*=============================================================================*
 * 콤마를 제거한 숫자형태 문자열로 반환(부호와 소수점도 없앰)
 *
 * param : val
 *
 * return : String
 *============================================================================*/
function getOnlyNumber(val)
{
  var value = "";
  var abit;
  if (typeof val != "number" && typeof val !="string")
  {
    return "0";
  }
  if (val.length < 1)
  {
    return "0";
  }
  if (val == "NaN")
  {
    return "0";
  }
  if (val == "-Infinity")
  {
    return "0";
  }

  for (i=0;i<val.length;i++)
  {
    abit = parseInt(val.substring(i,i+1));
    if (('0' < abit) || ('9' > abit) )
    {
      value = value + abit;
    }
  }
  return value;
}

/*=============================================================================*
 * 콤마를 제거한 숫자형태 문자열로 반환(부호, 소수점 그대로)
 *
 * param : val
 *
 * return : String
 *============================================================================*/
  function getOnlyNumberDot(val)
  {

  	if (typeof val != "number" && typeof val !="string")
  	{
  		return "0";
  	}
  	if (val.length < 1)
  	{
  		return "0";
  	}
  	if (val == "NaN")
  	{
  		return "0";
  	}
  	if (val == "-Infinity")
  	{
  		return "0";
  	}

  	var value = "";
  	var abit; // 소수부분

  	var delimter = val.indexOf(".");
  	var numberInteger = ""; // 정수부분

  	if(delimter < 0) {
  		numberInteger = val;
  		abit ='';
  	} else {
  		numberInteger = val.substring(0,delimter);
  		abit = val.substring(delimter+1);
  	}

  	var number="";
  	var leng=numberInteger.length ;
  	for(i=0 ; i<leng ; i++)
  	{
  		var tmp = numberInteger.substring(i,i+1);
  		if(tmp != ",")
  		{
  			number = number+tmp;
  		}
  	}

  	if(abit.length==0)
  	{
  		value=number;
  	}
  	else
  	{
  		value = number+"."+abit;
  	}
  	return value;

  }

/*=============================================================================*
 * 콤마를 제거한 부호가 있는 숫자형태 문자열로 반환
 *
 * param : val
 *
 * return : String
 *============================================================================*/
function getOnlySignNumber(val)
{
  if (val == "-") return 0;
  var price = eval(getOnlyNumber(val));
  if (val.substring(0,1) == "-")
  {
    price *= -1;
  }
  return price;
}
/*=============================================================================*
 * 조회조건 시작일과 종료일 입력 유효성 확인 - 컨트롤 이용
 *
 * param : fromDate, toDate
 *
 * return : boolean
 *============================================================================*/
function chkPeriod_Emedit(fromDate, toDate)
{

	var fromDate = fromDate.replace(/\-/g, '');
	var toDate   = toDate.replace(/\-/g, '');
	if (fromDate=="")
	{
		return false;
	}
	else if (toDate=="")
	{
		return false;
	}
	else if (fromDate > toDate)
	{
		alert("마지막일이 시작일보다 작습니다.");
		return false;
	}
	return true;
}

/*=============================================================================*
 * 조회조건 시작일과 종료일이 지정한 년도보다 작은지 판단
 *
 * param : fromDate, toDate, yearCnt
 *
 * return : boolean
 *============================================================================*/
function chkPeriod_year(fromDate, toDate, yearCnt) {
	var fromDate   = fromDate.replace(/\-/g, '');
	var toDate     = toDate.replace(/\-/g, '');

	var from_date  = new Date(fromDate.substring(0,4),fromDate.substring(4,6),fromDate.substring(6,8),"00","00"); //시작일
	var to_date	   = new Date(toDate.substring(0,4),toDate.substring(4,6),toDate.substring(6,8),"00","00");       //종료일
	var day        = 1000 * 3600 * 24;   //24시간
	var day_interval=parseInt((to_date - from_date) / day);
	
	if(day_interval > (365*yearCnt)+1){
		alert('조회기간은 '+ yearCnt +'년 이내만 가능합니다.');
		return false;
	}	
	return true;
}

/*=============================================================================*
 * 앞뒤 공백을 제거한다.
 *
 * param : sVal
 *
 * return : String
 *============================================================================*/
function Trim(sVal)
{
  return(LTrim(RTrim(sVal)));
}
/*=============================================================================*
 * 앞 공백을 제거한다.
 *
 * param : sVal
 *
 * return : String
 *============================================================================*/
function LTrim(sVal)
{
  var i;
  i = 0;
  while (sVal.substring(i,i+1) == ' ')
  {
    i++;
  }
  return sVal.substring(i);
}
/*=============================================================================*
 * 뒤 공백을 제거한다.
 *
 * param : sVal
 *
 * return : String
 *============================================================================*/
function RTrim(sVal)
{
  var i = sVal.length - 1;
  while (i >= 0 && sVal.substring(i,i+1) == ' ')
  {
    i--;
  }
  return sVal.substring(0,i+1);
}
//------------------------------------------------------------------------------
// DESCRIPTION  : 공백문자 제거
// 함수명       : MTrim(공백이 있는 문자열)
// Return Value : 공백이 제거된 문자열
//------------------------------------------------------------------------------
function MTrim(sVal){
	var strOri = sVal;
	var space = " ";

	while (strOri.indexOf(space) != -1){
		strOri = strOri.replace(space, "");
	}
	return strOri;
}
/*=============================================================================*
 * 공백만 존재하거나 아무것도 없는지 확인한다.
 *
 * param : sVal
 *
 * return : boolean (true이면 공백이나 Empty이다)
 *============================================================================*/
function isEmpty(sVal){
  if (MTrim(sVal) == '')
  {
    return true;
  }
  return false;
}
/*=============================================================================*
 * 현재 컨트롤과 MaxLength 받아서 MaxLength 되면 다음 컨트롤로 이동
 *
 * param : objCurrent, objNext
 *
 * return :
 *============================================================================*/
function focusMove(objCurrent, objNext)
{
  if ( objCurrent.getAttribute("Maxlength") == objCurrent.value.length)
  {
    objNext.focus();
  }
}
/*=============================================================================*
 * 현재 컨트롤과 MaxLength 받아서 MaxLength 되면 다음 컨트롤로 이동(선택)
 * param : objCurrent, objNext
 * return :
 *============================================================================*/
function focusMoveSelect(objCurrent, objNext)
{
  if ( objCurrent.getAttribute("Maxlength") == objCurrent.value.length)
  {
    objNext.focus();
    objNext.select();
  }
}
/*=============================================================================*
 * 완료된 날짜값에 대해 "/" 추가
 * param : me(value)
 * return : String
 *============================================================================*/
function calOnMask(me){
 if (event.keyCode<48||event.keyCode>57){//숫자외금지
     event.returnValue=false;
 }
	if(me.length > 3 ) {
		var a1 = me.substring(0,4) + "-";
		var a2 = me.substr(4,me.length);
		var a3 = "";
		if (me.length > 5){
			a2 = me.substring(4,6) + "-0";
			a3 = me.substr(6,me.length);
		}

		me= a1 + a2 + a3;

	}
	return me;
}
/*=============================================================================*
 * 날짜값 "/" 제거
 * param :  me(value)
 * return : String "-" 제거된 날짜값
 *============================================================================*/
function calOffMask(me){
	var tmp=me.split("-");
	tmp=tmp.join("");
	return tmp;
}
/*=============================================================================*
 * 날짜값 자동 "-" 붙임.(완성된 날짜값에 대해 /붙임)
 *
 * param :
 *
 * return :
 *============================================================================*/
function cal_value2(me){
 	if(me.length == 8 ) {
		var a1 = me.substring(0,4) + "-";
		var a2 = me.substring(4,6) + "-";
		var	a3 = me.substr(6,me.length);

		me= a1 + a2 + a3;

	}
	return me;
}
/*=============================================================================*
 * 오늘 날짜 생성 ( "/" 붙여서 리턴)
 *
 * param :
 *
 * return : todate
 *============================================================================*/
function todate() {
	var now=new Date()
	var jyear = now.getYear();
	var month=now.getMonth() + 1;
	var jmonth = month + "";
	if (jmonth.length < 2) {
		jmonth = "0" + jmonth;
	}
	var dat=now.getDate();
	var jdate = dat + "";
	if (jdate.length < 2) {
		jdate = "0" + jdate;
	}

	//var day=Birdy.getDay()//요일
    var tdy = jyear+"/"+jmonth+"/"+jdate;
	return tdy;
}

/*--------------------------------------------------------------------------------------------
 Spec	  : 숫자입력시 3자리마다 자동으로 콤마 찍기
 Argument : string
 Return   : string
 Example  : onkeyup="comma_value(this)"
---------------------------------------------------------------------------------------------*/
function comma_value(sval)
{
    if (event.keyCode != 9)
    {
        var cur = sval.value;
        var setMinus = 0;
        if (cur.charAt(0) == "-") {
            setMinus = 1;
        }
        cur=cur.replace(/[^.0-9]/g ,"");
        cur=cur.replace(/[.]+/g ,".");
        if (setMinus == 1)
            sval.value = "-" + formatNumbertoString(cur);
        else
            sval.value = formatNumbertoString(cur);
    }
}
/*--------------------------------------------------------------------------------------------
 Spec	  : 숫자입력시 3자리마다 자동으로 콤마 찍기
 Argument : string
 Return   : string
 Example  : onkeyup="comma_value(str)"
---------------------------------------------------------------------------------------------*/
function formatNumbertoString(cur)
{
    leftString = cur;
    rightString = ".";
    dotIndex = 0;

    for(i = 0; i < cur.length; i++){
    	// 1) '.'이 처음에 입력 되었을때 앞에 0을 더해 "0."을 리턴
		// 2) "0."이외의 입력 일 때 "0"만 리턴
    	if(cur.charAt(i) == "." || (cur.length > 1 && cur.charAt(0) == "0" && cur.charAt(1) != "."))
		{
    		dotIndex = i;
    		if(dotIndex == 0)
			{
                if   (cur.charAt(0) == ".")   leftString="0.";
                else                          leftString="";
    			return leftString;
    		}
    		break;
    	}
    }

     if(dotIndex != 0)	//dot가 있을 경우..
    {
    	leftString = cur.substr(0, dotIndex);
    	rightString = cur.substr(dotIndex+1);
    	rightString = rightString.replace(/\./g,"");
    }
    else //없으면..
    {
    	leftString = cur;
    }
    len=leftString.length-3;
    while(len>0)
    {
        leftString=leftString.substr(0,len)+","+leftString.substr(len);
        len-=3;
    }

    if(rightString != ".")
        return (leftString + "." + rightString);
    else
        return leftString;
}
// 숫자만 입력 (소수점 허용, 음수 허용)
// 사용법 : onKeyPress = onlyNum();
function onlyNum()
{
	if (event.keyCode < 45 || event.keyCode > 57 || event.keyCode == 47)
		event.returnValue = false;
}
// 숫자만 입력 (소수점 허용, 음수 불가)
// 사용법 : onKeyPress = onlyNum2();
function onlyNum2()
{
	if (event.keyCode < 46 || event.keyCode > 57 || event.keyCode == 47)
		event.returnValue = false;
}
// 숫자만 입력 (소수점 불가, 음수 허용)
// 사용법 : onKeyPress = onlyNum3();
function onlyNum3()
{
	if (event.keyCode < 45 || event.keyCode > 57 || event.keyCode == 46 || event.keyCode == 47)
		event.returnValue = false;
}
// 숫자만 입력 (소수점 불가, 음수 불가)
// 사용법 : onKeyPress = onlyNum4();
function onlyNum4()
{
	if (event.keyCode < 48 || event.keyCode > 57)
		event.returnValue=false;
}

function onlyChar(sval)
{
	var sBit = '';
	str = sval.value;
	for(i=0;i<str.length;i++)
	{
		sBit = str.charAt(i);

		if(escape( sBit ).length <= 4)
	    {
			var sAlphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

			if(sAlphabet.indexOf(sBit) < 0)
		    {
				alert("영문 또는 한글만 입력해 주세요.");
				return false;
			}
		}
	}
	return true;
}

/*=============================================================================*
 * 입력완료된 숫자값에 대하여 콤마를 찍어줄때 사용(소수점 이하 처리 안됨)
 * 콤마 형식을 사용할 경우에는 onkeyup이벤트로 사용하기 바라며,
 * 다음의 펑션을 호출할때는 comma_value(me) 펑션을 호출하기 바람.
 * param : value
 *============================================================================*/
function numOnMask(me){
	var tmpH = null;
	if(me.charAt(0)=="-"){//음수가 들어왔을때 '-'를 빼고적용되게..
		tmpH=me.substring(0,1);
		me=me.substring(1,me.length);
	}	//me.indexOf('-')
 	if(me.length > 3){
 		var c=0;
 		var myArray=new Array();
   		for(var i=me.length;i>0;i=i-3){
    			myArray[c++]=me.substring(i-3,i);
  	 	}
   		myArray.reverse();
  	 	me=myArray.join(",");
 	 }
	 if(tmpH){
 	 	me=tmpH+me;
 	 }
	return me;
}
/*=============================================================================*
 * 콤마가 들어간 숫자에서 ","를 뺀다.
 * param : value
 *============================================================================*/
function numOffMask(me){
	    var tmp=me.split(",");
 	    tmp=tmp.join("");
	    return tmp;
}
// 입력 완료된 숫자 값에 컴마를 적용하여준다(소수점 이하는 "," 안 붙음)
// return : String
function numOnMask2(me){
	 var tmpH;
	if(!isMoneyNumber4(me)) {
			if(me.charAt(0)=="-"){//음수가 들어왔을때 '-'를 빼고적용되게..
				tmpH=me.substring(0,1);
				me=me.substring(1,me.length);
			}	//me.indexOf('-')
			if(me.length > 3){
				var c=0;
				var myArray=new Array();
				for(var i=me.length;i>0;i=i-3){
						myArray[c++]=me.substring(i-3,i);
				}
				myArray.reverse();
				me=myArray.join(",");
			 }
			 if(tmpH){
				me=tmpH+me;
			 }
	}else{
			var e = me;
			e = e.split(".");
			var myStr = e[0];
			//alert(myStr);
			if(myStr.charAt(0)=="-"){//음수가 들어왔을때 '-'를 빼고적용되게..
				tmpH=myStr.substring(0,1);
				myStr=myStr.substring(1,me.length);
			}	//me.indexOf('-')
			if(myStr.length > 3){
				var c=0;
				var myArray=new Array();
				for(var i=myStr.length;i>0;i=i-3){
						myArray[c++]=myStr.substring(i-3,i);
				}
				myArray.reverse();
				myStr=myArray.join(",");
			 }
			 if(tmpH){
				me=tmpH+myStr+"."+e[1];
			 }
			 else {
				me=myStr+"."+e[1];
			 }
	}
return me;
}
// 입력 완료된 숫자 값에 컴마를 적용하고 소수점 이하는 삭제한다
// return : String
function numOnMask3(me){ //단순히 값에 컴마를 적용할때 사용
	var tmpH;
	if(isMoneyNumber3(me)) { // 양수&음수 체크 (true : 양수, false : 음수)
		var e = me;
		e = e.split(".");
		var myStr = e[0];
		if(myStr.length > 3){
			var c=0;
			var myArray=new Array();
			for(var i=myStr.length;i>0;i=i-3){
					myArray[c++]=myStr.substring(i-3,i);
			}
			myArray.reverse();
			myStr=myArray.join(",");
		 }
		 me = myStr;
	}else{ // 음수 일때
		var e = me;
		e = e.split(".");
		var myStr = e[0];
		if(myStr.charAt(0)=="-"){//음수가 들어왔을때 '-'를 빼고적용되게..
			tmpH=myStr.substring(0,1);
			myStr=myStr.substring(1,me.length);
		}
		if(myStr.length > 3){
			var c=0;
			var myArray=new Array();
			for(var i=myStr.length;i>0;i=i-3){
					myArray[c++]=myStr.substring(i-3,i);
			}
			myArray.reverse();
			myStr=myArray.join(",");
		 }
		 if(tmpH){
			me=tmpH+myStr;
		 }
		 else {
			me=myStr;
		 }
	}
return me;
}
/*=============================================================================*
 * 입력값을 소수점 이하 몇 자리까지 보여줄지 정한다.
 * 소수점 이하 자리수가 입력된 값보다 작으면 0으로 채운다.
 * param : sVal 입력스트링, iSize 소수자릿수
 * return : String
 *============================================================================*/
function numOnMask4(sVal,iSize)
{
	if(isNumberDot(sVal))		// 숫자형인지 확인
	{
		var e = sVal;
		e = e.split(".");
		if (!e[1]) {
			if (iSize == 0) {
			    sVal = numOnMask(e[0]);
				return sVal;
			}
			else {
				e[1] = "0";
			}
		}
		while (e[1].length < iSize) {    // 주어진 소숫점 이하 자릿수 만큼 뒤에 "0" 추가
		    e[1] = e[1] + "0";
		}
		sVal = numOnMask(e[0]) + "." + e[1].substr(0,iSize);
		return sVal;
	}
	else {
		return false;
	}
}

/*=============================================================================*
 * 입력값에 마스킹을 적용한다.(소수점 이하와 부호를 삭제하고 콤마추가)
 * param : sVal 입력스트링
 * return : String
 *============================================================================*/
function numOnMask5(sVal)
{
	var e = sVal;
	e = e.split(".");
	if(!isMoneyNumber3(e[0]))				// true이면 양수, false이면 음수
		e[0] = e[0].substring(1)
	return numOnMask(e[0]);
}
/*=============================================================================*
 * 입력값에 마스킹을 적용한다.(부호를 삭제하고 콤마추가. 소수점은 그대로 둠)
 * param : sVal 입력스트링
 * return : String
 *============================================================================*/
function numOnMask6(sVal)
{
	var e = sVal;
	e = e.split(".");
	if(!isMoneyNumber3(e[0]))		// isMoneyNumber3 - true이면 양수, false이면 음수
		e[0] = e[0].substring(1);
	return numOnMask(e[0]) + "." + e[1];
}

/*=============================================================================*
 * 숫자 외의 값이 입력되어있으면 false 리턴
 * param : sval (object)
 * return :
 *============================================================================*/
function onlyNumber(sval) {
	var strVal = sval.value
	if (strVal.length < 1) {
	    return false;
	}
	strVal = numOffMask(strVal);
	var result = isNumberDot(strVal);
	if (!result) {
	   	//alert("숫자만 입력 가능합니다.");
		sval.focus();
		return false;
	}
}

/*=============================================================================*
 * 특수문자 값이 입력되었는지 체크(특수문자가 있으면 false 리턴)
 * param : sval (object)
 * return :
 *============================================================================*/
function chkValidChar(o) {
	var re		= new RegExp("[%\']","ig");
	var retVal	= re.test(o.value);
	if(retVal == true)
	{
		alert("검색어에 다음 문자를 사용할 수 없습니다 : \n\n %,\' ");
		o.value = "";
		return false;
	}
    else
    	return true;
}
/**
 * 두 날짜에 며칠 차이나는지 구함
 * from_val이 to_val보다 크면 -붙여서 리턴
 */
function getDayInterval(from_val,to_val) {
    var day   = 1000 * 3600 * 24; //24시간
	if(isDate(from_val)==false)
	{
		return;
	}
	if(isDate(to_val)==false)
		return;

	var from_date=toTimeObject(from_val);
	var to_date=toTimeObject(to_val);
	var day_interval=parseInt((to_date - from_date) / day, 10);
    //alert(to_date+" - "+from_date+"="+day_interval);
	return day_interval;
}

/* 변경일자  : 20100826                                                       */
/* ITSM 번호 : ChM-000002748                                                  */
/* CQ ID     : CQKDB00017499                                                  */
/* 제목      : 전자공시시스템(KIND)내 K-IFRS 지원 서비스 개설 방안            */
/* 승인자    : 장정희                                                         */
/* 작업자    : 이성진                                                         */
    /**
     * 이메일 정합성 검사
     */
    function email_chk(objEmail) {

        var email = objEmail.value;

        var invalidChars = "\"|&;<>!*\'\\"   ;

        for (var i = 0; i < invalidChars.length; i++) {

            if (email.indexOf(invalidChars.charAt ) != -1) {

                alert("잘못된 이메일 주소입니다.");

                objEmail.focus();

                return false;
            }
        }

        if (email.indexOf("@") == -1){

            alert("잘못된 이메일 주소입니다. '@'가 없습니다..");

            objEmail.focus();

            return false;
        }

        if (email.indexOf(" ") != -1){

            alert("잘못된 이메일 주소입니다.");

            objEmail.focus();

            return false;
        }

        if (window.RegExp) {

            var reg1str = "(@.*@)|(\\.\\.)|(@\\.)|(\\.@)|(^\\.)";
            var reg2str = "^.+\\@(\\[?)[a-zA-Z0-9\\-\\.]+\\.([a-zA-Z]{2,3}|[0-9]{1,3})(\\]?)$";
            var reg1 = new RegExp (reg1str);
            var reg2 = new RegExp (reg2str);

            if (reg1.test(email) || !reg2.test(email)) {

                alert("잘못된 이메일 주소입니다.");

                objEmail.focus();

                return false;
            }
        }

        return true;
    }

/**
 * Time 스트링을 자바스크립트 Date 객체로 변환
 * parameter time: Time 형식의 String
 */
function toTimeObject(time) { //parseTime(time)
    var year  = time.substr(0,4);
    var month = time.substr(4,2) - 1; // 1월=0,12월=11
    var day   = time.substr(6,2);
    return new Date(year,month,day);
}
// readonly나 disabled로 막힌 경우를 제외하고 tabindex 값을 지정하여 입력박스 순서대로 이동
function tabIndexing()
{
    elements = document.all;
    for (i=0;i<elements.length ;i++)
    {
        if(elements[i].readOnly == false){
           elements[i].tabIndex = i;
        }
    }
}

//iframe 리싸이즈 관련 함수
//사용법 - iframe화면의 온로드시 호출해 주면 됩니다.
function frameSize(){
	var height = document.body.scrollHeight;
  //document.body.scrollIntoView(false);

  parent.document.all.iframe.height=height;
  parent.document.getElementById("footerWrap").style.top = height;
}
//iframe 리싸이즈 관련 함수2
//사용법 - iframe화면의 온로드시 호출해 주면 됩니다.
function frameSize2(){

  var height2 = document.body.scrollHeight+ (document.body.offsetHeight - document.body.clientHeight);
  if(parent.document.getElementById("iframeList").contentDocument && parent.document.getElementById("iframeList").contentDocument.body.offsetHeight){

    parent.document.getElementById("iframeList").height= parent.document.getElementById("iframeList").contentDocument.body.offsetHeight + 17;

  }
  else if(parent.document.getElementById("iframeList").Document && parent.document.getElementById("iframeList").Document.body.scrollHeight){

    parent.document.getElementById("iframeList").height=height2;

  }

  //parent.document.getElementById("footerWrap").style.top= parent.document.getElementById("iframeList").height;
  //parent.document.getElementById("iframeList").height=height2;
}
function frame_1Size(){

	var height = document.body.scrollHeight;

  //document.body.scrollIntoView(false);
  parent.document.all.iframe_1.height=height;

  parent.document.getElementById("footerWrap").style.top = height;
}
function frame_1Size2(){

  var height2 = document.body.scrollHeight+ (document.body.offsetHeight - document.body.clientHeight);

  if(parent.document.getElementById("iframeList2").contentDocument && parent.document.getElementById("iframeList2").contentDocument.body.offsetHeight){
    parent.document.getElementById("iframeList2").height= parent.document.getElementById("iframeList2").contentDocument.body.offsetHeight + 17;
  }
  else if(parent.document.getElementById("iframeList2").Document && parent.document.getElementById("iframeList2").Document.body.scrollHeight){
    parent.document.getElementById("iframeList2").height=height2;
  }

    //parent.document.getElementById("footerWrap").style.top = parent.document.getElementById("iframeList2").height;

  //parent.document.getElementById("iframeList").height=height2;
}

function fn_setSysDate(fromData){
    var vDate, vMon, vDay;
    vDate = new Date();

	var fromData  = document.getElementById(fromData);
	var ie        = document.all;

    if(!ie){
        vDate.setFullYear(vDate.getYear() + 1900);
    }
    else{
        vDate.setFullYear(vDate.getYear());
    }

    //-- 월 <10
    if((vDate.getMonth() + 1) < 10){ vMon = "0" + String(vDate.getMonth() + 1); }
    else                           { vMon =       String(vDate.getMonth() + 1); }

    if(vDate .getDate() < 10){ vDay = "0" + String(vDate.getDate()); }
    else                     { vDay =       String(vDate.getDate()); }

    fromData.value = String(vDate.getFullYear()) + "-" + String(vMon) + "-" + String(vDay);
}

function fn_setTime_future(pIndex, fromData, toData){

    var fromData  = document.getElementById(fromData);
    var toData    = document.getElementById(toData);
    var ie        = document.all;

    switch(pIndex){

        case '7D'  : fn_setDate_future    		(7, fromData, toData, ie); break;
        case '1M'  : fn_setMonth_future   		(1, fromData, toData, ie); break;
        case '3M'  : fn_setMonth_future   		(3, fromData, toData, ie); break;
        case '6M'  : fn_setMonth_future   		(6, fromData, toData, ie); break;
        case '1Y'  : fn_setFullYear_future		(1, fromData, toData, ie); break;
        case '2Y'  : fn_setFullYear_future		(2, fromData, toData, ie); break;
        case '3Y'  : fn_setFullYear_future		(3, fromData, toData, ie); break;
        case '5Y'  : fn_setFullYear_future		(5, fromData, toData, ie); break;
        case 'FD'  : fn_setFullDate_future		(   fromData, toData, ie); break;
        case 'LFD' : fn_setFullDate_future		(   fromData, toData, ie); break; //상장업무 전산화용
        case '6D'  : fn_setDate_future    		(6, fromData, toData, ie); break;
    }

    fn_changeOnMode(pIndex);
}

function fn_setDate_future(pNewDd, fromData, toData, ie){

    var vDate, vDate2,  vMon2, vMon, vDay2, vDay;
    vDate  = new Date();
    vDate2 = new Date();

    vDate .setDate(vDate.getDate()         );
    vDate2.setDate(vDate.getDate() + pNewDd);

    //-- 월 <10
    if((vDate2.getMonth() + 1) < 10){ vMon2 = "0" + String(vDate2.getMonth() + 1); }
    else                            { vMon2 =       String(vDate2.getMonth() + 1); }

    if((vDate .getMonth() + 1) < 10){ vMon  = "0" + String(vDate .getMonth() + 1); }
    else                            { vMon  =       String(vDate .getMonth() + 1); }

    //-- 일 <10
    if(vDate2.getDate() < 10){ vDay2 = "0" + String(vDate2.getDate()); }
    else                     { vDay2 =       String(vDate2.getDate()); }

    if(vDate .getDate() < 10){ vDay  = "0" + String(vDate .getDate()); }
    else                     { vDay  =       String(vDate .getDate()); }

    fromData.value  = String(vDate .getFullYear()) + "-" + String(vMon ) + "-" + String(vDay );
    toData  .value  = String(vDate2.getFullYear()) + "-" + String(vMon2) + "-" + String(vDay2);
}

function fn_setMonth_future(pNewmonth, fromData, toData, ie){

    var vDate, vDate2, vMon2, vMon, vDay2, vDay;

    vDate  = new Date();
    vDate2 = new Date();

    vDate .setMonth(vDate.getMonth()            );
    vDate2.setMonth(vDate.getMonth() + pNewmonth);

    //-- 월 <10
    if((vDate2.getMonth() + 1) < 10){ vMon2 = "0" + String(vDate2.getMonth() + 1); }
    else                            { vMon2 =       String(vDate2.getMonth() + 1); }

    if((vDate .getMonth() + 1) < 10){ vMon  = "0" + String(vDate .getMonth() + 1); }
    else                            { vMon  =       String(vDate .getMonth() + 1); }

    //-- 일 <10
    if(vDate2.getDate() < 10){ vDay2 = "0" + String(vDate2.getDate()); }
    else                     { vDay2 =       String(vDate2.getDate()); }

    if(vDate .getDate() < 10){ vDay  = "0" + String(vDate .getDate()); }
    else                     { vDay  =       String(vDate .getDate()); }

    fromData.value = String(vDate .getFullYear()) + "-" + String(vMon ) + "-" + String(vDay );
    toData  .value = String(vDate2.getFullYear()) + "-" + String(vMon2) + "-" + String(vDay2);

}

function fn_setFullYear_future(pNewyear, fromData, toData, ie){

    var vDate, vDate2,  vMon2, vMon, vDay2, vDay;

    vDate  = new Date();
    vDate2 = new Date();

    if(!ie){

        vDate .setFullYear(vDate.getYear() + 1900           );
        vDate2.setFullYear(vDate.getYear() + 1900 + pNewyear);
    }

    else{

        vDate .setFullYear(vDate.getYear()           );
        vDate2.setFullYear(vDate.getYear() + pNewyear);
    }

    //-- 월 <10
    if((vDate2.getMonth() + 1) < 10){ vMon2 = "0" + String(vDate2.getMonth() + 1); }
    else                            { vMon2 =       String(vDate2.getMonth() + 1); }

    if((vDate .getMonth() + 1) < 10){ vMon  = "0" + String(vDate .getMonth() + 1); }
    else                            { vMon  =       String(vDate .getMonth() + 1); }

    //-- 일 <10
    if(vDate2.getDate() < 10){ vDay2 = "0" + String(vDate2.getDate()); }
    else                     { vDay2 =       String(vDate2.getDate()); }

    if(vDate .getDate() < 10){ vDay  = "0" + String(vDate .getDate()); }
    else                     { vDay  =       String(vDate .getDate()); }

    fromData.value = String(vDate .getFullYear()) + "-" + String(vMon ) + "-" + String(vDay );
    toData  .value = String(vDate2.getFullYear()) + "-" + String(vMon2) + "-" + String(vDay2);
}

function fn_setFullDate_future(fromData, toData, ie){

    var vDate, vMon, vDay;

    vDate = new Date();

    if(!ie){

        vDate.setFullYear(vDate.getYear() + 1900);
    }

    else{

        vDate.setFullYear(vDate.getYear());
    }

    //-- 월 <10
    if((vDate.getMonth() + 1) < 10){ vMon = "0" + String(vDate.getMonth() + 1); }
    else                           { vMon =       String(vDate.getMonth() + 1); }

    if(vDate .getDate() < 10){ vDay = "0" + String(vDate.getDate()); }
    else                     { vDay =       String(vDate.getDate()); }

    fromData.value = String(vDate.getFullYear()) + "-" + String(vMon) + "-" + String(vDay);
    toData  .value = '9999-12-31';
}

/*=============================================================================*
 * 원하는 기간의후의 날짜 가져오기
 * param : fn_setTime (pIndex, fromData, toData)
 * return :
 *============================================================================*/
function fn_setTime(pIndex, fromData, toData){

	var fromData  = document.getElementById(fromData);
	var toData    = document.getElementById(toData);
	var ie		  = document.all;
	switch(pIndex){
		case '7D' :
			fn_setDate(7, fromData, toData, ie); break;
		case '1M' :
			fn_setMonth(1, fromData, toData, ie);	break;
		case '3M' :
			fn_setMonth(3, fromData, toData, ie);	break;
		case '6M' :
			fn_setMonth(6, fromData, toData, ie);	break;
		case '1Y' :
			fn_setFullYear(1, fromData, toData, ie); break;
		case '2Y' :
			fn_setFullYear(2, fromData, toData, ie); break;
		case '3Y' :
			fn_setFullYear(3, fromData, toData, ie); break;
		case '5Y' :
			fn_setFullYear(5, fromData, toData, ie); break;
		case 'FD' :
			fn_setFullDate(fromData, toData, ie); break;
		case 'LFD' :
			fn_setLmtFullDate(fromData, toData, ie); break;
		case '6D' :
			fn_setDate(6, fromData, toData, ie); break;
	}

	fn_changeOnMode(pIndex);
}

function fn_changeOnMode(pIndex)
{
	try{document.getElementById("period_7D").src = "../images/common/term_1w_off.gif";}catch (e){}
	try{document.getElementById("period_1M").src = "../images/common/term_1m_off.gif";}catch (e){}
	try{document.getElementById("period_3M").src = "../images/common/term_3m_off.gif";}catch (e){}
	try{document.getElementById("period_6M").src = "../images/common/term_6m_off.gif";}catch (e){}
	try{document.getElementById("period_1Y").src = "../images/common/term_1y_off.gif";}catch (e){}
	try{document.getElementById("period_2Y").src = "../images/common/term_2y_off.gif";}catch (e){}
	try{document.getElementById("period_3Y").src = "../images/common/term_3y_off.gif";}catch (e){}
	try{document.getElementById("period_5Y").src = "../images/common/term_5y_off.gif";}catch (e){}
	try{document.getElementById("period_FD").src = "../images/common/term_all_off.gif";}catch (e){}

	try{
		switch(pIndex){
		    case '7D' :
					document.getElementById("period_7D").src = "../images/common/term_1w_on.gif";
					break;
				case '1M' :
					document.getElementById("period_1M").src = "../images/common/term_1m_on.gif";
					break;
				case '3M' :
					document.getElementById("period_3M").src = "../images/common/term_3m_on.gif";
					break;
				case '6M' :
					document.getElementById("period_6M").src = "../images/common/term_6m_on.gif";
					break;
				case '1Y' :
					document.getElementById("period_1Y").src = "../images/common/term_1y_on.gif";
					break;
				case '2Y' :
					document.getElementById("period_2Y").src = "../images/common/term_2y_on.gif";
					break;
				case '3Y' :
					document.getElementById("period_3Y").src = "../images/common/term_3y_on.gif";
					break;
				case '5Y' :
					document.getElementById("period_5Y").src = "../images/common/term_5y_on.gif";
					break;
				case 'FD' :
					document.getElementById("period_FD").src = "../images/common/term_all_on.gif";
					break;
				case 'LFD' : //상장업무전산화용
					document.getElementById("period_FD").src = "../images/common/term_all_on.gif";
					break;
	  }

		}catch (e){}
}


//7일 전 날짜 구하기
function fn_setDate(pNewDd, fromData, toData, ie){

	var vDate, vDate2,  vMon2, vMon, vDay2, vDay;
	vDate = new Date();
	vDate2 = new Date();
	vDate.setDate(vDate.getDate());
	vDate2.setDate(vDate.getDate()-pNewDd);
	//-- 월 <10
	if ( (vDate2.getMonth()+1) < 10 ) vMon2 = "0"+String(vDate2.getMonth()+1);
	else vMon2 =String(vDate2.getMonth()+1);
	if ( (vDate.getMonth()+1) < 10 ) vMon = "0"+String(vDate.getMonth()+1);
	else vMon =String(vDate.getMonth()+1);
	//-- 일 <10
	if ( vDate2.getDate() < 10 ) vDay2 = "0"+String(vDate2.getDate());
	else vDay2 =String(vDate2.getDate());
	if ( vDate.getDate() < 10 ) vDay = "0"+String(vDate.getDate());
	else vDay =String(vDate.getDate());
	fromData.value  = String(vDate2.getFullYear())+"-"+String(vMon2)+"-"+String(vDay2);
	toData.value    = String(vDate.getFullYear())+"-"+String(vMon)+"-"+String(vDay);

}

//한달전, 6개월전 날자 구하기
function fn_setMonth(pNewmonth, fromData, toData, ie){

	var vDate, vDate2, vMon2, vMon, vDay2, vDay;

	vDate = new Date();
	vDate2 = new Date();
	vDate.setMonth(vDate.getMonth());
	vDate2.setMonth(vDate.getMonth()-pNewmonth);

	//-- 월 <10
	if ( (vDate2.getMonth()+1) < 10 ) vMon2 = "0"+String(vDate2.getMonth()+1);
	else vMon2 =String(vDate2.getMonth()+1);
	if ( (vDate.getMonth()+1) < 10 ) vMon = "0"+String(vDate.getMonth()+1);
	else vMon =String(vDate.getMonth()+1);
	//-- 일 <10
	if ( vDate2.getDate() < 10 ) vDay2 = "0"+String(vDate2.getDate());
	else vDay2 =String(vDate2.getDate());
	if ( vDate.getDate() < 10 ) vDay = "0"+String(vDate.getDate());
	else vDay =String(vDate.getDate());
	fromData.value  = String(vDate2.getFullYear())+"-"+String(vMon2)+"-"+String(vDay2);
	toData.value    = String(vDate.getFullYear())+"-"+String(vMon)+"-"+String(vDay);
}
//6개월보다 큰지 적은지 체크
function fn_checkMonth(pNewmonth, fromData, toData){

	var vDate, vDate2, vMon2, vMon, vDay2, vDay;
	var returnVal = false;
	var vYear3, vMonth3, vDate3, vformDate;
	var vYear4, vMonth4, vDate4, vtoDate;
	vYear3    = fromData.substr(0, 4);
	vMonth3   = fromData.substr(5, 2) - 1;
	vDate3    = fromData.substr(8, 2);
	vformDate = new Date(vYear3, vMonth3, vDate3);
	vYear4    = toData.substr(0, 4);
	vMonth4   = toData.substr(5, 2) - 1;
	vDate4    = toData.substr(8, 2);
	vtoDate = new Date(vYear4, vMonth4, vDate4);

	vDate2 = new Date(vYear4, vMonth4, vDate4);
	vDate2.setMonth(vtoDate.getMonth()-pNewmonth);
    if(vformDate >= vDate2){
       returnVal = true;
	}
	return returnVal;
}
//1년전, 2년전, 3년전의 날짜 구하기
function fn_setFullYear(pNewyear, fromData, toData, ie){
	var vDate, vDate2,  vMon2, vMon, vDay2, vDay;
	vDate = new Date();
	vDate2 = new Date();
	if(!ie){
		vDate.setFullYear(vDate.getYear()+1900);
		vDate2.setFullYear(vDate.getYear()+1900-pNewyear);
	}else{
		vDate.setFullYear(vDate.getYear());
		vDate2.setFullYear(vDate.getYear()-pNewyear);
	}

	//-- 월 <10
	if ( (vDate2.getMonth()+1) < 10 ) vMon2 = "0"+String(vDate2.getMonth()+1);
	else vMon2 =String(vDate2.getMonth()+1);

	if ( (vDate.getMonth()+1) < 10 ) vMon = "0"+String(vDate.getMonth()+1);
	else vMon =String(vDate.getMonth()+1);

	//-- 일 <10
	if ( vDate2.getDate() < 10 ) vDay2 = "0"+String(vDate2.getDate());
	else vDay2 =String(vDate2.getDate());

	if ( vDate.getDate() < 10 ) vDay = "0"+String(vDate.getDate());
	else vDay =String(vDate.getDate());


	fromData.value  = String(vDate2.getFullYear())+"-"+String(vMon2)+"-"+String(vDay2);
	toData.value    = String(vDate.getFullYear())+"-"+String(vMon)+"-"+String(vDay);
}
function fn_setFullDate(fromData, toData, ie){
	var vDate, vMon, vDay;
	vDate = new Date();
	if(!ie){
		vDate.setFullYear(vDate.getYear()+1900);
	}else{
		vDate.setFullYear(vDate.getYear());
	}
	//-- 월 <10
	if ( (vDate.getMonth()+1) < 10 ) vMon = "0"+String(vDate.getMonth()+1);
	else vMon =String(vDate.getMonth()+1);
	if ( vDate.getDate() < 10 ) vDay = "0"+String(vDate.getDate());
	else vDay =String(vDate.getDate());
	fromData.value  = '1999-01-01';
	toData.value    = String(vDate.getFullYear())+"-"+String(vMon)+"-"+String(vDay);

}

/** 상장업무전산화용 */
function fn_setLmtFullDate(fromData, toData, ie){
	var vDate, vMon, vDay;
	vDate = new Date();
	if(!ie){
		vDate.setFullYear(vDate.getYear()+1900);
	}else{
		vDate.setFullYear(vDate.getYear());
	}
	//-- 월 <10
	if ( (vDate.getMonth()+1) < 10 ) vMon = "0"+String(vDate.getMonth()+1);
	else vMon =String(vDate.getMonth()+1);
	if ( vDate.getDate() < 10 ) vDay = "0"+String(vDate.getDate());
	else vDay =String(vDate.getDate());
	fromData.value  = '2000-01-01';
	toData.value    = String(vDate.getFullYear())+"-"+String(vMon)+"-"+String(vDay);
}

/** 오른쪽 공백 제거 */
function  funcRtrim( str ) {
    var src = new String(str);
    var tmp = new String();
    var i,lastnum, len = src.length;
    for(i = len;i >= 0;i--) {
        tmp = src.substring(i,i-1);
        if (tmp != ' ' ) {
            lastnum = i;
            break;
        }
    }
    tmp = src.substring(0,lastnum);
    return tmp;
}

/** 왼쪽 공백 제거 */
function  funcLtrim( str ) {
    var src = new String( str );
    var tmp = new String();
    var i,firstnum, len = src.length;
    for(i = 0;i < len ;i++) {
        tmp = src.substring(i,i+1);
        if (tmp != ' ' ) {
            firstnum = i;
            break;
        }
    }
    tmp = src.substring(firstnum);
    return tmp;
}

/** 공백 제거 */
function  funcTrim( str ) {
    var src = new String(str);
    var tmp = new String();
    tmp = funcLtrim(funcRtrim(str));
    return tmp;
}


/*=============================================================================*
 *
 * 윈도우 오픈1 (사용자 지정 위치생성)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function win_open(wUrl,wTitle,wTop,wLeft,wWidth,wHeight,wSco) {
	window.open(wUrl,wTitle,"top="+wTop+",left="+wLeft+",width="+wWidth+",height="+wHeight+",scrollbars="+wSco+",toolbar=no, resizable=no, status=yes");
}
/*=============================================================================*
 *
 * 윈도우 오픈(상장회사개황:법인개황)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function companysummary_open(isurCd) {	
var frm = document.popForm;
var html = "<form name='popForm'><input type='hidden' name='strIsurCd' value='"+isurCd+"'/><input type='hidden' name='lstCd' value='"+lstCd+"'></form>";
	if(frm == "undefined" || frm == undefined){
		 $("section").first().append(html);
		 frm = document.popForm;
		}else{
			frm.strIsurCd.value = isurCd ;
			frm.lstCd.value = lstCd ;
		}
	
	var pop_title = "popup";
	var wUrl = "/common/companysummary.do?method=searchCompanySummary";
	window.open("",pop_title,"top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");	
	
	frm.target = pop_title;
	frm.action = wUrl;
	frm.submit();	
	
}


/*=============================================================================*
 * 윈도우 오픈(상장회사개황:법인개황)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function companysummary_open(isurCd, lstCd) {
	
var frm = document.popForm;
var html = "<form name='popForm' method='post'><input type='hidden' name='strIsurCd' value='"+isurCd+"'/><input type='hidden'name='lstCd' value='"+lstCd+"'></form>";
	if(frm == "undefined" || frm == undefined){
		 $("section").first().append(html);
		 frm = document.popForm;
		}else{
			frm.strIsurCd.value = isurCd ;
			frm.lstCd.value = lstCd ;
		}
	
	var pop_title = "popup";
	var wUrl = "/common/companysummary.do?method=searchCompanySummary";
	window.open("",pop_title,"top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");	
	
	frm.target = pop_title;
	frm.action = wUrl;
	frm.submit();	
	
	
}
/*=============================================================================*
 * 윈도우 오픈(법인개황)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function companyHistory_open(isurCd, taskDd,spotIsuTrdMktTpCd) {
	var wUrl = "/common/companysummary.do?method=searchCompanyHistory&strIsurCd="+isurCd+"&taskDd="+taskDd+"&spotIsuTrdMktTpCd="+spotIsuTrdMktTpCd;
	window.open(wUrl,"상장회사개황","top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");
}
/*=============================================================================*
*
* 윈도우 오픈(ETF종목정보/종합정보)
* param : wUrl		지정url
* param : wTitle	지정타이틀
* param : wTop		지정 창 높이정렬기준
* param : wLeft	지정 창 왼쪽정렬기준
* param : wWidth	창넓이
* param : wHeight	창높이
* param : wSco		스크롤바 생성유무, 1:생성 0:비생성
* 나중에 공지사항 오픈할때 사용할 스크립트
* 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
*============================================================================*/
function etfisusummary_open(isurCd) {
	var wUrl = "/disclosure/etfisudetail.do?method=searchEtfIsuSummary&strIsurCd="+isurCd;
	window.open(wUrl,"ETF종목정보","top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");
}
/*=============================================================================*
*
* 윈도우 오픈(상장형수익증권종목정보/종합정보)
* param : wUrl		지정url
* param : wTitle	지정타이틀
* param : wTop		지정 창 높이정렬기준
* param : wLeft	지정 창 왼쪽정렬기준
* param : wWidth	창넓이
* param : wHeight	창높이
* param : wSco		스크롤바 생성유무, 1:생성 0:비생성
* 나중에 공지사항 오픈할때 사용할 스크립트
* 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
*============================================================================*/
function pfisusummary_open(isurCd) {
	var wUrl = "/disclosure/pfisudetail.do?method=searchPfIsuSummary&strIsurCd="+isurCd;
	window.open(wUrl,"상장형수익증권종목정보","top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");
}
/*=============================================================================*
*
* 윈도우 오픈(ETN종목정보/종합정보)
* param : wUrl		지정url
* param : wTitle	지정타이틀
* param : wTop		지정 창 높이정렬기준
* param : wLeft	지정 창 왼쪽정렬기준
* param : wWidth	창넓이
* param : wHeight	창높이
* param : wSco		스크롤바 생성유무, 1:생성 0:비생성
* 나중에 공지사항 오픈할때 사용할 스크립트
* 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
*============================================================================*/
function etnisusummary_open(isuSrtCd) {
	var wUrl = "/disclosure/etnisudetail.do?method=searchEtnIsuSummary&strIsuSrtCd="+isuSrtCd;
	window.open(wUrl,"ETN종목정보","top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");
}
/*=============================================================================*
 *
 * 윈도우 오픈(증시일정)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function stockschedule_open() {
	var wUrl = "/common/stockschedule.do?method=StockScheduleMain";
	window.open(wUrl,"증시일정","top=0, left=0, width=1150, height=770, scrollbars=yes, toolbar=no, resizable=yes");
}

/*=============================================================================*
 *
 * 윈도우 오픈(오늘의 시세-주가차트)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function fnPopStockPrices(isurCd) {
	var wUrl = "/common/stockprices.do?method=searchStockPricesMain&isurCd="+isurCd;
	window.open(wUrl,"오늘의시세","top=100,left=100,width=910,height=650,scrollbars=yes,toolbar=no, resizable=no");
}
/*=============================================================================*
 *
 * 윈도우 오픈(제안사항)
 * param : wUrl		지정url
 * param : wTitle	지정타이틀
 * param : wTop		지정 창 높이정렬기준
 * param : wLeft	지정 창 왼쪽정렬기준
 * param : wWidth	창넓이
 * param : wHeight	창높이
 * param : wSco		스크롤바 생성유무, 1:생성 0:비생성
 * 나중에 공지사항 오픈할때 사용할 스크립트
 * 예)win_open('/common/readnoticedetailed.do?method=readNoticeDetailed&contnId='+val,'공지사항내용','100','100','600','600','yes');
 *============================================================================*/
function sendproposure_open() {
	//var wUrl = "/common/sendproposure.do?method=sendProposureMain";
	//window.open(wUrl,"제안사항","top=100,left=100,width=775,height=350,scrollbars=no,toolbar=no, resizable=no");
	//openFindWindow();
    //window.open('http://find.krx.co.kr','','location=yes, scrollbars=yes,toolbar=yes,resizable=yes,status=yes,width=800,height=600,left=0,top=0');
    location.href="mailto:web@krx.co.kr";
}

/*=============================================================================*
 * 채권상장공시 팝업
 *============================================================================*/
function openBondsDetail(acptno, type){
	if(acptno == null){ acptno = ""; return false; }

	var params	= "&bndMktactTpCd="+type+"&bndApplId="+acptno;
	var wUrl	= "/disclosure/bonds.do?method=searchBondsNewListInfo"+params;
	if(type == "305"){
		wUrl = "/disclosure/bonds.do?method=searchBondsAddListInfo"+params;
	} else if(type == "303" || type == "304"){
		wUrl = "/disclosure/bonds.do?method=searchBondsHalfwyReamptInfo"+params;
	} else if(type == "302" || type == "315"){
		wUrl = "/disclosure/bonds.do?method=searchBondsExerInfo"+params;
	} else if(type == "311"){
		wUrl = "/disclosure/bonds.do?method=searchBondsBdaplOpDdChgInfo"+params;
	}

	var option = "top=100,left=100,width=700,height=500,scrollbars=no;toolbar=no,resizable=yes";
	window.open(wUrl,"",option);
}

/*=============================================================================*
 * 공시뷰어 관련 함수 정의 시작
 *============================================================================*/

/*
 * 공시뷰어 오픈
 * acptno : 접수번호
 * docno : 문서번호
 * author : lds010
 */
function openDisclsViewer(acptno, docno){
	searchHostAddrOfDisclsViewer(acptno, docno);
}


/*
 * 공시뷰어 오픈 (접수번호, 문서번호)
 * param : acptno : 접수번호
 * param : docno  : 문서번호
 * author : lds010
 */
function openDisclsViewerWithDocNo(acptno, docno){
	if(docno == null){ docno = ""; }
	var wUrl = "/common/disclsviewer.do?method=searchInitInfo&acptNo=" + acptno + "&docNo=" + docNo;
	var option = "top=100,left=100,width=1024,height=768,scrollbars=no;toolbar=no,resizable=yes";
	window.open(wUrl,"",option);
}

// 공시뷰어 호출을 위한 Host Address를 가져온다.
function searchHostAddrOfDisclsViewer(acptno, docno){


    var url = "/common/disclsviewer.do?method=searchHostAddrOfDisclsViewer&acptno=" + acptno + "&docno=" + docno;

    xmlHttpForDisclsViewer = createXMLHttpRequest();

    //xmlHttpForDisclsViewer.onreadystatechange = handleStateChangeForHostAddr;

    xmlHttpForDisclsViewer.onreadystatechange = function(){


        if(xmlHttpForDisclsViewer.readyState == 4) {
	        if(xmlHttpForDisclsViewer.status == 200) {
	            openDisclsViewer2();
	        }
        }

    }

    xmlHttpForDisclsViewer.open("GET", url, true);

    xmlHttpForDisclsViewer.send(null);
}

var xmlHttpForDisclsViewer;
function createXMLHttpRequest() {
    var xmlHttpForDisclsViewer = null;
    if (window.ActiveXObject) {
        xmlHttpForDisclsViewer = new ActiveXObject("Microsoft.XMLHTTP");
    }
    else if (window.XMLHttpRequest) {
        xmlHttpForDisclsViewer = new XMLHttpRequest();
    }
    return xmlHttpForDisclsViewer;
}

function handleStateChangeForHostAddr() {

    if(xmlHttpForDisclsViewer.readyState == 4) {
        if(xmlHttpForDisclsViewer.status == 200) {
            openDisclsViewer2();
        }
    }
}

var viewerhostaddr = null; //호스트어드레스

function openDisclsViewer2(){

    var responseXML = xmlHttpForDisclsViewer.responseXML;
    var element = responseXML;

    var nodeList = element.getElementsByTagName("item");

    //alert(nodeList.length);
    var node = nodeList[0];
    var state = null;   //해당 법인 존재유무(0:없음, 1:있음)
    var acptno = null; //접수번호
	var docno = null;  //문서번호

	if(node.getElementsByTagName("acptno")[0].firstChild != null){
		acptno = node.getElementsByTagName("acptno")[0].firstChild.nodeValue;
	}else{
		acptno = "";
	}
	if(node.getElementsByTagName("docno")[0].firstChild != null){
		docno = node.getElementsByTagName("docno")[0].firstChild.nodeValue;
	}else{
		docno = "";
	}
	if(node.getElementsByTagName("viewerhostaddr")[0].firstChild != null){
		viewerhostaddr = node.getElementsByTagName("viewerhostaddr")[0].firstChild.nodeValue;
	}else{
		viewerhostaddr = "";
	}

	var toolbar = "no";
	var title = "";
	var left = "0";
	var top = "0";
	var scrollbars = 'no';
	var resizable = 'yes';
	var status = 'yes';
	var width = 1024;
	var height = 800;
	//var width = 996;
	//var height = 650;
	//var url = viewerhostaddr + "/common/disclsviewer.do?method=search&acptno=" + acptno + "&docno=" + docno;
	var viewerhost = "";
	var viewerport = "";
	if (viewerhostaddr != null && viewerhostaddr.length)
	{
		viewerhostaddr = viewerhostaddr.substring(viewerhostaddr.indexOf(":") + 3);
		if (viewerhostaddr.indexOf(":") != -1)
		{
			viewerhost = viewerhostaddr.substring(0, viewerhostaddr.indexOf(":"));
			viewerport = viewerhostaddr.substring(viewerhostaddr.indexOf(":") + 1);
		}
	}

	var url = "/common/disclsviewer.do?method=search&acptno=" + acptno + "&docno=" + docno + "&viewerhost=" + viewerhost + "&viewerport=" + viewerport;

	//alert("url : " + url);
	var option = 'toolbar=' + toolbar + ',scrollbars='+scrollbars+', resizable=' + resizable + ',width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',status=' + status;

		//alert("option : " + option);

	//	window.open("http://www.naver.com","","width=300");

	//alert("before open");

	//window.open(url,"공시뷰어",option);
	window.open(url, "", option);
}

function extractHostAddr(){
}

/*=============================================================================*
 * 공시뷰어 관련 함수 정의 종료
 *============================================================================*/
/*
 * 회사명찾기
 * param :
 * param :
 * author : lds010
 */
function findCompanyName(){
	var x=0, y=0;
	var w = $(window).outerWidth();
	var h = $(window).outerHeight();

	x = Number(w)/2 - Number("580")/2;
	y = Number(h)/2 - Number("640")/2;

	var url = "/common/corpList.do?method=loadInitPage";
	window.open(url,'회사명찾기','scrollbars=yes,toolbar=no,resizable=no,width=580,height=640,left='+x+',top='+y+', status=yes');
}

/*
 * 회사명찾기 SSL
 * param :
 * param :
 * author : lds010
 */
function findCompanyNameSSL(){
	var x=0, y=0;
	var w = $(window).outerWidth();
	var h = $(window).outerHeight();

	x = Number(w)/2 - Number("580")/2;
	y = Number(h)/2 - Number("640")/2;

	var url = "/ssl/common/corpList.do?method=loadInitPage";
	window.open(url,'회사명찾기','scrollbars=yes,toolbar=no,resizable=no,width=580,height=640,left='+x+',top='+y+', status=yes');
}

/*
 * 회사명찾기(파라메터 있을 경우)
 * param :
 * param :
 * author : lds010
 */
function findCompanyNameWithParam(param){
	var x=0, y=0;
	var w = $(window).outerWidth();
	var h = $(window).outerHeight();

	x = Number(w)/2 - Number("580")/2;
	y = Number(h)/2 - Number("640")/2;

	var url = "/common/corpList.do?method=loadInitPage" + param;
	window.open(url,'회사명찾기','scrollbars=yes,toolbar=no,resizable=no,width=580,height=640,left='+x+',top='+y+', status=yes');
}

/*
 * 회사명찾기 (비상장포함)
 * param :
 * param :
 * author : lds010
 */
function fnFindCorpName() {

	var x=0, y=0;
	var w = $(window).outerWidth();
	var h = $(window).outerHeight();

	x = Number(w)/2 - Number("580")/2;
	y = Number(h)/2 - Number("640")/2;

	var url = "/common/corpListAll.do?method=loadInitPage&comnm_tffield=AKCKwd";
	window.open(url,'회사명찾기','scrollbars=yes,toolbar=no,resizable=no,width=580,height=640,left='+x+',top='+y+', status=yes');
}

/*
 * 회사명찾기(코넥스포함)
 * param :
 * param :
 * author : lds010
 */
function fnFindCorpName2(){
	findCompanyNameWithParam("&comnm_tffield=AKCKwd&pKonexFlag=Y");
}

function fnFindCorpNameTop(){
	findCompanyNameWithParam("&kwd=AKCKwdTop&comnm_tffield=AKCKwdTop&pKonexFlag=Y");
}


/*
 * 회사명찾기 (코넥스포함)
 * param :
 * param :
 * author : lds010
 */
function fnFindCorpNameSub() {
	findCompanyNameWithParam("&comnm_tffield=AKCKwd&pKonexFlag=Y&sub=Y");
}

/*
 * 제출인명찾기
 * author : lds010
 * param :
 * param :
 */
function findSubmitPerson(){
	var url = "/common/submitprsnm.do?method=loadInitPage";
	window.open(url,'제출인명찾기','scrollbars=yes,toolbar=no,resizable=no,width=540,height=650,left=0,top=0,status=yes');
}

/*
 * 제출인명찾기 - 의결권행사공시
 * author : lds346
 * param : 의결권행사공시 화면 여부
 */
function findSubmitPerson(sFlag){
	var url = "/common/submitprsnm.do?method=loadInitPage&voterghtExerFlag=" + sFlag;
	window.open(url,'제출인명찾기','scrollbars=yes,toolbar=no,resizable=no,width=540,height=650,left=0,top=0,status=yes');
}

/*
 보고서명찾기
 * author : lds010
 */
function findReportName(){
	var url = "/common/reportname.do?method=loadInitPage";
	window.open(url,'보고서명찾기','scrollbars=yes,toolbar=no,resizable=no,width=530,height=650,left=100,top=100,status=yes');
}
/*
 * 공시차트
 * isurcd : 발행기관코드
 * author : lds010
 */
function openDisclsChart(isurcd){
	var url = "/common/chart.do?method=loadInitPage&ispopup=true&isurcd=" + isurcd;
	window.open(url,'공시차트','scrollbars=yes,toolbar=no,resizable=no,width=850,height=750,left=0,top=0,status=yes');
}

/*
 * 정기보고서제출일정 팝업
 * author : lds010
 */
function openReportSchedule(){
	var url = "/common/marketschedule.do?method=loadInitPage";
	window.open(url,'정기보고서제출일정','scrollbars=yes,toolbar=no,resizable=no,width=900,height=450,left=0,top=0,status=yes');
}

/*
증시일정 팝업을 오픈하거나 IR일정 페이지로 이동하기
*/
function openSchedule(state){
	if(state == "stock"){
		stockschedule_open();
	}
	else if(state == "ir"){
		window.location.href = "/corpgeneral/irschedule.do?method=searchIRScheduleMain&gubun=iRScheduleCalendar";
	}
}

/*
 * 제도해설보기
 * param :
 * param :
 */
function explanationSystemView(val){
	var url = "/common/explanationsystemview.do?method=viewSysInfoDetail&sysInfoClssId="+val;
	window.open(url,'제도해설보기','scrollbars=yes,toolbar=no,resizable=no,width=800,height=510,left=0,top=0,status=yes');
}

/*
 * 주권 팝업
 * author : lds511
 */
function findStockIsu(stockIsuNm){
	var url="";

	if(stockIsuNm){
		url = "/common/stockisu.do?method=findStockIsuMain&stockIsuNm=" + stockIsuNm;
	}else{
		url = "/common/stockisu.do?method=findStockIsuMain";
	}
	window.open(url,'주권종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=620,left=0,top=0, status=yes');
}

/*
 * ELW종목 팝업
 * author : lds010
 */
function findElwIsu(){
	var url = "/common/elwisu.do?method=findElwIsuMain";
	window.open(url,'ELW종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * ETN종목 팝업
 * author : lds010
 */
function findEtnIsu(){
	var url = "/common/etnisu.do?method=findEtnIsuMain";
	window.open(url,'ETN종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * ETS종목 팝업(파생 투자주의-온실가스 배출권)
 * author : lds010
 */
function findEtsIsu(){
	var url = "/common/etsisu.do?method=findEtsIsuMain";
	window.open(url,'ETS종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * ETF종목 팝업
 * author : lds010
 */
function findEtfIsu(){
	var url = "/common/etfisu.do?method=findEtfIsuMain";
	window.open(url,'ETF종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * 상장형수익증권(공모펀드)종목 팝업
 * author : lbs
 */
function findPfIsu(){
	var url = "/common/pfisu.do?method=findPfIsuMain";
	window.open(url,'상장형수익증권종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * BDC종목 팝업
 * author : lds542
 */
function findBdcIsu(){
	var url = "/common/bdcisu.do?method=findBdcIsuMain";
	window.open(url,'BDC종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * 기초자산 찾기  팝업
 * author : lds010
 */
function findElwUly(){
	var url = "/common/elwuly.do?method=findElwUlyMain";
	window.open(url,'기초자산찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0,status=yes');
}

/*
 * 유동성공급자 찾기 팝업
 * author : lds010
 */
function findLpMbr(){
var url = "/common/lpmbr.do?method=findLpMbrMain";
	window.open(url,'유동성공급자찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0,status=yes');
}

/*
 * 코스닥소속부 종목 팝업
 * author : lds010
 */
function findKosdaqSec(){
	var url = "/common/kosdaqsection.do?method=findKosdaqSecMain";
	window.open(url,'종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=616,height=560,left=0,top=0, status=yes');
}

/*
 * 매입인도(Buy-in) 현황 종목 팝업
 * author : lds010
 */
function findBuyinStat(){
	var url = "/common/buyinstat.do?method=findBuyinStatMain";
	window.open(url,'종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=616,height=550,left=0,top=0, status=yes');
}
/*=============================================================================*
 *
 * 쿠키세팅
 * param : sMKTGubun		시장구분
 * param : sShtComCode		종목코드
 * param : sShtComNm		법인명
 *============================================================================*/
function setCookieSave(sMKTGubun, sShtComCode, sShtComNm){
  document.frm.action       = "/common/cookiesave.do"
  document.frm.method.value = "CookieSave&sMKTGubun="+sMKTGubun+"&sShtComCode="+sShtComCode+"&sShtComNm="+sShtComNm;
  document.frm.target       = "iframe";
	document.frm.submit();
}
/*
 공지사항 상세보기
 * author : lds010
 */
function openNoticeDetail(id){
	var url = "/common/readnoticedetailed.do?method=readNoticeDetailed&contnId=" + id;
	window.open(url,'공지사항상세','scrollbars=yes,toolbar=no,resizable=no,width=590,height=400,left=100,top=100,status=yes');
}
/*
 뉴스 상세보기
 * author : lds010
 */
function openNewsDetail(id){
	//alert("openNewsDetail");
	var browsing_window;
	var url = "/common/searchnews.do?method=searchNewsDetail&newsSndSeq=" + id;
	browsing_window = window.open(url,'뉴스상세','scrollbars=yes,toolbar=no,resizable=no,width=650,height=750,left=100,top=100,status=yes');
	browsing_window.focus();
}

/*
 * 지배구조우수법인 팝업
 */
function openGoodGovernanceCorp(){
	//alert('지배구조 우수법인');
	var url = "/common/JLDDST60234.jsp";
	window.open(url,'지배구조우수법인','scrollbars=yes,toolbar=no,resizable=no,width=700,height=400,left=100,top=100,status=yes');
}
/*
 * 코스닥경영진조회시스템 팝업
 */
function openOfficerSearch(){
	//alert('지배구조 우수법인');
	var url = "PersonInfo.do?method=itemSearch";
	window.open(url,'코스닥경영진조회시스템','scrollbars=yes,toolbar=no,resizable=no,width=817,height=600,left=100,top=100,status=yes');
}



/*
 * 디지털증권 비금전신탁수익증권 팝업 TC
 * 2023.08.XX   
 * author : cej
 */
function findDigitalTcIsu(){
	var url = "/common/findDigitalTc.do?method=findDigitalTcMain";
	window.open(url,'비금전신탁수익증권 종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * 디지털증권투자 투자증권종목 팝업 IC
 * 2023.08.XX   
 * author : cej
 */
function findDigitalIcIsu(){
	var url = "/common/findDigitalIc.do?method=findDigitalIcMain";
	window.open(url,'투자수익증권 종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}


/*
 * 디지털증권투자 전체조회 팝업 IC
 * 2023.10.XX   
 * marketType --> 1 = TC, 2 = IC, 3 = TC OR IC
 * author : cej
 */
function findDigitalIsu(marketType){ 
	var url = "/common/findDigitalAll.do?method=findDigitalAllMain&marketType="+marketType;
	window.open(url,'종목명찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}
  




/*
 * 디지털증권 비금전신탁수익증권 상장법인 팝업 TC
 * 2023.08.XX   
 * author : cej
 */
function findDigitalTcListApplntIsurCd(){
	var url = "/common/findDigitalIsurCdTc.do?method=findDigitalIsurCdTcMain";
	window.open(url,'비금전신탁수익증권 상장법인찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

/*
 * 디지털증권투자  투자증권종목 상장법인 팝업 IC
 * 2023.08.XX   
 * author : cej
 */
function findDigitalIcListApplntIsurCd(){
	var url = "/common/findDigitalIsurCdIc.do?method=findDigitalIsurCdIcMain";
	window.open(url,'투자수익증권 상장법인찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}

 
/*
 * 디지털증권 상장법인별 상장종목 조회 상장법인 팝업 
 * 2023.09.XX   
 * marketType --> 1 = TC, 2 = IC, 3 = TC OR IC
 * author : cej
 */
function findDigitalListApplntIsurCd(marketType){
	var url = "/common/findDigitalIsurCdAll.do?method=findDigitalIsurCdMain&marketType="+marketType;
	window.open(url,'상장법인별 상장종목 조회 상장법인찾기','scrollbars=no,toolbar=no,resizable=no,width=500,height=560,left=0,top=0, status=yes');
}
  
/*=============================================================================*
*
* 윈도우 오픈(디지털증권 상장법인별 상장종목 조회 팝업 )
* 2023.09.XX    	 
* listApplntIsurCd 상장법인코드
* author : cej
*============================================================================*/
function fnDigitalCorpListPop(listApplntIsurCd){
	var url = "/digital/digitalCorpListPop.do?method=digitalCorpListPop&listApplntIsurCd="+listApplntIsurCd;
	window.open(url,'상장법인별 상장종목 List 조회','scrollbars=no,toolbar=no,resizable=no,width=1000,height=1000,left=0,top=0, status=yes');
}

/*=============================================================================*
*
* 윈도우 오픈(디지털 증권 투자계약증권  IC , 신탁수익증권  TC)
* 2023.08.XX   
* param : isuSrtCd 종목코드		 
* author : cej
*============================================================================*/
function digitalisusummary_open(isuSrtCd) {
 
	var wUrl = "/digital/digitalDetail.do?method=searchDigitalIsuSummary&strIsurCd="+isuSrtCd;
	window.open(wUrl,"디지털증권종목정보","top=100,left=100,width=1020,height=770,scrollbars=yes,toolbar=no,resizable=no,status=no");
}

/*=============================================================================*
*
* 윈도우 오픈(KRX-Papago번역기)
* 2023.12.15   		 
* author : yic
*============================================================================*/
function krxPaPago_open() {
 
	var wUrl = "/common/krxPapago.do?method=openPapagoTranslator";
	window.open(wUrl,"KRX-Papago번역기","top=100,left=100,width=1450,height=820,scrollbars=no,toolbar=no,resizable=no,status=no");
}


/*
 * 채권상장 팝업상세
 * author : lds010
 */
function fnOpenBondDetailInfo(bndMktactTpCd, bndApplId){
	var method = "searchBondsNewListInfo";
	if(bndMktactTpCd.match("111,121,131,141,151")){
		method = "searchBondsNewListInfo";
	}
	if(bndMktactTpCd.match("305")){
		method = "searchBondsAddListInfo";
	}
	if(bndMktactTpCd.match("303,304")){
		method = "searchBondsHalfwyReamptInfo";
	}
	if(bndMktactTpCd.match("302,315")){
		method = "searchBondsExerInfo";
	}
	var url = "/disclosure/bonds.do?method="+method+"&bndApplId="+bndApplId;
	window.open(url,'채권상장','scrollbars=yes,toolbar=no,resizable=no,width=800,height=480,left=0,top=0,status=yes');
}

/*
 * Table TR Row 색깔을 mode에 따라 변경한다.
 * TRobj : TR 객체
 * mode : in(커서가 객체로 에 들어왔을 때), out(커서가 객체에서 나갔을 때)
 * trstat : 0 - TR이 무색인 경우, 1 - TR이 유색인 경우
 * author : lds010
 */
function changeTableRowColor(TRobj, mode, trstat){

	 if(mode == "in"){
		 TRobj.style.backgroundColor='#D9E6E5';
	 }
	 else if(mode == "out"){
		 if(     trstat == "0"){    TRobj.style.backgroundColor='#FFFFFF';   }
		 else if(trstat == "1"){    TRobj.style.backgroundColor='#F5F5F5';   }
	 }
}

/**
 * 조회 조건 값의 유효성 확인
 * fromDateObj : 시작일 input object
 * toDateObj   : 종료일 input object
 * author : lds010
 */
function checkDateValidation(fromDateObj, toDateObj){

    var fromDate = fromDateObj.value;
    var toDate = toDateObj.value;
    var message = null;
    //시작날짜 길이 확인
    if(fromDate != ""){
        if(toDate == ""){
            alert("종료일을 입력해주세요.");
            toDateObj.focus();
            return false;
        }
        if(fromDate.length != 10){
            alert("날짜 형식이 맞지 않습니다.");
            fromDateObj.focus();
            return false;
        }
    }
    //종료날짜 길이 확인
    if(toDate != ""){
        if(fromDate == ""){
            alert("시작일을 입력해주세요.");
            fromDate.focus();
            return false;
        }
        if(toDate.length != 10){
            alert("날짜 형식이 맞지 않습니다.");
            toDateObj.focus();
            return false;
        }
    }
    //시작일, 종료일 크기 확인
    if( fromDate != "" && toDate != "" ){
        if( validateStartDateAndToDate(fromDate, toDate) == false ){
            message = "시작일이 종료일 보다 최근 날짜입니다. 기간을 정확히 입력해주세요.";
            alert(message);
            return false;
        }
    }
    return true;
}
/**
 * 시작날짜와 종료날짜 정합성 체크
 * 사용예) validate(frm.fromDate.value, frm.toDate.value)
 * author : lds010
 */
function validateStartDateAndToDate(fromDateVal, toDateVal){
	var fromDateVal = fromDateVal.replace(/\-/g, '');
	var toDateVal = toDateVal.replace(/\-/g, '');
	if(Number(fromDateVal) > Number(toDateVal)){
		return false;
	}
	else{
		return true;
	}
}
/**
 * 시작날짜와 종료날짜 정합성 체크 (범위)
 * 사용예) validate(frm.fromDate.value, frm.toDate.value)
 * author : lds010
 */
function validateStartDateAndToDateWithRange(fromDateVal, toDateVal, range){
	var fromDateVal = fromDateVal.replace(/\-/g, '');
	var toDateVal = toDateVal.replace(/\-/g, '');
	var frm = Number(fromDateVal);
	var to = Number(toDateVal);
	//alert(to - frm);
	if(frm < to){
		var tmpVal = to - frm;
		if(tmpVal > range){
			return false;
	    }
		else{
			return true;
		}
	}
	return false;
}

/**
 * 조회 조건 값의 유효성 확인
 * fromObj : 시작값 input object
 * toObj   : 종료값 input object
 * author : lds010
 */
function compareTwoValueOfAccnt(accntName, fromObj, toObj){
	//alert("compareTwoValueOfAccnt");

    var fromVal = fromObj.val();
    var toVal = toObj.val();
	var message = "";

    //시작일, 종료일 크기 확인
    if( fromVal != "" && toVal != "" ){
        if( validateStartEndValue(fromVal, toVal) == false ){
            message = accntName + "의 시작값이 종료값 보다 큽니다.\n값의 범위를 정확히 입력해주세요.";
            alert(message);
            return false;
        }
    }
    return true;
}
function validateStartEndValue(startVal, endVal){
	var startVal = startVal.replace(/,/g, "");
	var endVal = endVal.replace(/,/g, "");
	if(Number(startVal) > Number(endVal)){
		return false;
	}
	else{
		return true;
	}
}

function gShowWindow (strPageURL, strWindowName, lngWidth, lngHeight, strOptions) {
	var lngTop, lngLeft;

	if (strOptions == "") {
		strOptions = "toolbar=no, location=no, menubar=no, scrollbars=yes, status=yes, resizable=no";
	}

	lngTop = (window.screen.height - lngHeight) / 2;
	lngLeft = (window.screen.width - lngWidth) / 2;
	strOptions = strOptions + ", width=" + lngWidth + ", height=" + lngHeight + ", top=" + lngTop + ", left=" + lngLeft;

	var newWin = window.open(strPageURL,strWindowName,strOptions);
	//newWin.focus();
}

/* 변경일자  : 20100817                                                       */
/* ITSM 번호 : ChM-000002748                                                  */
/* CQ ID     : CQKDB00017499                                                  */
/* 제목      : 전자공시시스템(KIND)내 K-IFRS 지원 서비스 개설 방안            */
/* 승인자    : 장정희                                                         */
/* 작업자    : 이성진                                                         */
    /**
     * file객체와 Array타입의 file객체와 fileType과
     */
    function LimitAttach(obj, fileType) {

        var file = obj.value;

        allowSubmit = true;

        if (!file) return;

        while (file.indexOf("\\") != -1){

            file = file.slice(file.indexOf("\\") + 1);
        }

        ext = file.slice(file.indexOf(".")).toLowerCase();

        for (var i = 0; i < fileType.length; i++) {

            if (fileType[i] == ext) { allowSubmit = false; break; }
        }

        if(!allowSubmit){

            alert((fileType.join("  ")) + "확장자를 가진 파일은 업로드할 수 없습니다.\n다시 파일을 선택하십시오.");

            obj.focus();

            return false;
        }

        return true;
    }

    function chkStrNull(str,field){

        if(str.value == null || str.value == ""){

            alert(field + "을(를) 입력하세요.");

            str.select();
            str.focus ();

            return false;
        }

        return true;
    }

    function chkStrNullLength(str, field){

        var strNull   = false;
        var strLength = false;

        strNull = chkStrNull(str, field);

        if(!strNull){

            return false;
        }

        else{

            strLength = chkStrLength(str, field);

            if(!strLength){

                return false;
            }
        }

        return true;
    }

    /**
     * 텍스트필드의 정수(음수포함)값에 콤마를 붙인다.
     * tfObj : 텍스트필드 객체
     * 사용예) onkeyup='setNumberTypeWithComma(this)'
     */
    function setNumberTypeWithComma(tfObj){
    	setNumberTypeWithComma1(tfObj, '-int');
    }
    function setNumberTypeWithComma1(tfObj,type){
        /*
        type
        -> 'int' : 양의 정수
        -> 'float' : 양의 실수
        -> '-int' : 음의 정수 포함
        -> '-float' : 음의 실수 포함
        */
        temp_value = tfObj.value.toString();

    	/*
    	while(temp_value.indexOf(",") > -1) {
    	  temp_value = temp_value.replace(",", "");
    	}
    	*/

    	//먼저 컴마 제거 필요
    	var num=new String(tfObj.value);
    	    num=num.replace(/,/gi,"");


        regexp = /[^-\.0-9]/g;
        repexp = '';
        temp_value = temp_value.replace(regexp,repexp);
        regexp = '';
        repexp = '';
        switch(type){
            case 'int':     regexp = /[^0-9]/g; break;
            case 'float':regexp = /^(-?)([0-9]*)(\.?)([^0-9]*)([0-9]*)([^0-9]*)/; break;

            case '-int':    regexp = /^(-?)([0-9]*)([^0-9]*)([0-9]*)([^0-9]*)/;break;

    		case '-float':regexp = /^(-?)([0-9]*)(\.?)([^0-9]*)([0-9]*)([^0-9]*)/; break;
            default : regexp = /[^0-9]/g; break;
        }
        switch(type){
            case 'int':repexp = '';break;
            case 'float':repexp = '$2$3$5';break;
            case '-int':    repexp = '$1$2$4';break;
            case '-float':repexp = '$1$2$3$5'; break;
            default : regexp = /[^0-9]/g; break;
        }
        temp_value = temp_value.replace(regexp,repexp);
        //tfObj.value = temp_value;

    	if(temp_value == '-'){
    		tfObj.value = temp_value;
    		return;
    	}

    	//컴마를 붙임
    	tfObj.value = applyComma(temp_value);
    }

    function applyComma(num){
    	var sign="";
    	if(isNaN(num)) {
    		alert("숫자만 입력할 수 있습니다.");
    		return 0;
    	}

    	if(num==0) {
    		return num;
    	}

    	if(num<0){
    		num=num*(-1);
    		sign="-";
    	} else {
    		num=num*1;
    	}

    	num = new String(num)
    	var temp="";
    	var pos=3;
    	num_len=num.length;

    	while (num_len>0){
    		num_len=num_len-pos;
    		if(num_len<0) {
    			pos=num_len+pos;
    			num_len=0;
    		}
    		temp=","+num.substr(num_len,pos)+temp;
    	}
    	return sign+temp.substr(1);
    }
/* 년,월,일 계산 
*  sDate :날짜 nNum : 차이 type:년,월,일
*/
    function dateAddDel(sDate, nNum, type) {
    	var d;
    	var yy = parseInt(sDate.substr(0,4), 10);
    	var mm = parseInt(sDate.substr(5,2), 10);
    	var dd = parseInt(sDate.substr(8), 10);
    	
    	if (type == "d") {
    		d = new Date(yy, mm - 1, dd + nNum);
    	} else if (type == "m") {
    		d = new Date(yy, mm + nNum, -1);
    		if (d.getDate() + 1 < dd) {
    			dd = d.getDate() + 1;
    		}
    		d = new Date(yy, mm - 1 + nNum, dd);
    	} else if (type == "y") {
    		d = new Date(yy + nNum, mm, -1);
    		if (d.getDate() + 1 < dd) {
    			dd = d.getDate() + 1;
    		}
    		d = new Date(yy + nNum, mm - 1, dd);
    	}
    	
    	yy = d.getFullYear();
    	mm = d.getMonth() + 1;
    	dd = d.getDate(); 
    	mm = setDateMmDd(mm);
    	dd = setDateMmDd(dd);
    	
    	return '' + yy + '-' + mm + '-' + dd;
    }


    function setDateMmDd(dd) {
    	dd = (dd < 10) ? '0' + dd : dd;
    	
    	return dd;
    }
    
    function chkPeriod2Mil(dateVal){	
     	dateVal = dateVal.replace(/-/gi,"");
    	if(dateVal.length == 8){
    		if(dateVal.substring(0,4) < 2000){
    			alert("2000년부터 조회 가능합니다.");
    			$("#searchForm").find("input:text[name=fromDate]").val("2000-01-01");
    			return false;
    		}else{
    			return true;
    		}
    	}
    }

function getIsuNameWithAc() {	
	
	var param = {
			q : $("#AKCKwd").val()
	}; 
	
	commonAjax("/common/stockisu.do?method=akcIsuName", "get", param, false, getIsuNameWithAcCallBack);
}

/*
* 국문 자동완성(종목명)
*/
function getIsuNameWithAcCallBack(data) {					
	
	var strHtml='';
	var isuKorAbbrvList= new Array();	
	var isuSrtCdList= new Array();
	var marketList= new Array();
	var industryList= new Array();
	var listDdList= new Array();	
	var isuList= new Array();			
	
	if(data){
		if(data.resultList.length ==0){
			$("#AKCDiv").hide();
		}else{
			$(data.resultList).each(function(i, item){		
				
			    //strHtml += 	'<div id="akc_' + i + '\" onMouseDown="akc_search_url(\'' + item.isuSrtCd + '\',\'' + item.isuKorAbbrv + '\')" onmouseover="akc_curstyle(this)" onmouseout="akc_prvstyle(this)" style="">';	    	    

			    strHtml += 	'<div id="akc_' + i + '\" onMouseDown="akc_search_isu(\'' + item.spotIsuTrdMktTpCd + '\',\'' + item.isuSrtCd + '\',\'' + item.isuKorAbbrv + '\',\'' + item.isuCd +  '\',\'' + item.grpNm + '\',\'' + item.listDd + '\')" onmouseover="akc_curstyle(this)" onmouseout="akc_prvstyle(this)" style="">';	   			    
			    strHtml += 	'<table width="100%" cellpadding="0" cellspacing="0">';
			    strHtml += 	'  <tbody>';
			    strHtml += 	'  <tr>';
			    strHtml += 	'  <td style="width:20%; font-size:12px;">' + item.isuSrtCd + '</td>';
			    strHtml += 	'  <td style=" font-size:12px;" align="left">' + item.isuKorAbbrv + '</td>';
			    strHtml += 	'  </tr>';
			    strHtml += 	'  </tbody>';
			    strHtml += 	'</table>';
			    strHtml += 	'</div>';
			    
			    isuKorAbbrvList.push({KEYWORD: item.isuKorAbbrv});
			    isuSrtCdList.push({NUM: item.isuSrtCd});
			    marketList.push({MARKET: item.spotIsuTrdMktTpCd});
			    industryList.push({INDUSTRY: item.grpNm});
			    listDdList.push({LISTDD: item.listDd});
			    isuList.push({ISUCD: item.isuCd});
			});	
			$("#AKCIDiv").append(strHtml);
			akc_done(isuKorAbbrvList, isuSrtCdList,  $("#AKCKwd").val(), $("#AKCKwd").val(), marketList, industryList, listDdList, isuList);
			akc_scroll(0);
       }
	}else{
		$("#AKCDiv").hide(); //elk서버 접근실패 등일 경우
	}
		
}

function commonAjax(urls, types, param, isSync, functionToCallBack, language, targetObj, contentName) {
	//기본은 비동기
	var isAsync = false;
	
	if (typeof isSync == 'boolean') {
		isAsync = isSync;
	}
	
	var params = param;
	var contentTypeNm = 'application/x-www-form-urlencoded';
	
	//무조건 JSON 처리
	try {
		params = param.serialize();
	} catch (e) {
		// TODO: targetObj paging logic
		if (Array.isArray(param)) {
			contentTypeNm = 'application/json; charset=UTF-8';
			params = JSON.stringify(param);
		} else {
			params = param;
		}
	}
	
	var rtnData = '';
	var request = $.ajax({
							url: urls
							,type: types
							,data: params
							,dataType: 'json'
							,async: isSync
							,contentType: contentTypeNm
							,beforeSend: function() {
								//loadingPopup();
							}
							,complete: function() {
								//loadingCPopup();
							}
						});
	urls = urls.toLowerCase();
	request.done(function(resultData) {
		if (typeof functionToCallBack == 'function') {
			functionToCallBack(resultData, language);
		} else {
			rtnData = resultData;
		}
		
	}).fail(function(xhr, request, status) {
		var responseT = xhr.responseText;
		//console.log(responseT);
		//console.log(responseT.resultCode);
	});
	
	if(!isAsync && typeof functionToCallBack != 'function') {
		return rtnData;
	}
}
    

/*
 * 공지사항 상세 오픈 (contnId, type)
 * param : contnId : 공지사항 번호
 * param : bbsType  : 공지사항(01), 자료실(06)
 * author : lds511
 */
function openNoticeDetail(contnId, bbsType){
	if(contnId == null){ return; }
	
	if (bbsType == "01"){
		var wUrl = "/valueup/notice.do?method=valueupNoticeSubDetail&contnId=" + contnId + "&bbsType=" + bbsType;
	}else if(bbsType == "06"){
		var wUrl = "/valueup/resoroom.do?method=valueupResoroomSubDetail&contnId=" + contnId + "&bbsType=" + bbsType;
	}else{
		return; 
	}
	
	var option = "top=100,left=100,width=1024,height=450,left=750,top=280,scrollbars=no;toolbar=no,resizable=yes";
	window.open(wUrl,"",option);
}    

/*
 * 파생야간 공지사항 상세 오픈 (ndvNotiNo)
 * param : ndvNotiNo : 공지사항 번호
 */
function openNdvNoticeDetail(ndvNotiNo){
	if(ndvNotiNo == null){ return; }

	var wUrl = "/disclosure/ndvnoti.do?method=ndvNotiSubDetail&ndvNotiNo=" + ndvNotiNo ;

	var option = "top=100,left=100,width=1024,height=450,left=750,top=280,scrollbars=no;toolbar=no,resizable=yes";
	window.open(wUrl,"",option);
}    
     