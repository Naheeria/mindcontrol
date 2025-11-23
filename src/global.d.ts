// global.d.ts

/**
 * TypeScript의 Window 인터페이스를 확장하여
 * 전역 window 객체에 직접 추가된 사용자 정의 속성을 선언합니다.
 */
interface Window {
    // _app_id는 문자열이거나 정의되지 않았을 수 있습니다.
    _app_id: string | undefined; 
    
    // _initial_auth_token도 마찬가지로 문자열이거나 정의되지 않았을 수 있습니다.
    _initial_auth_token: string | undefined;
  }