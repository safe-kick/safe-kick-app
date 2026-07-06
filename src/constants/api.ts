// 웹 브라우저 테스트 → localhost 그대로
// 실제 폰(Android) 테스트 → PC의 IP로 변경
//   WSL에서 확인: ip addr | grep eth0
//   예) export const API_BASE = 'http://192.168.0.10';

// Node.js 서버
export const API_BASE = 'http://localhost';

// Raspberry Pi
export const RASPI_IP = '10.10.141.46';
export const RASPI_API_BASE = `http://${RASPI_IP}:8000`;
