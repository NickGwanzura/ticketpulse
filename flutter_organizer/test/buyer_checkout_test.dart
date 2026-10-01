import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:ticketpulse/data/api.dart';
import 'api_test.dart' show MemoryStore, json;
void main() {
 test('checkout identity survives restart and status uses signed access', () async {
  final store=MemoryStore(); final bodies=<Map<String,dynamic>>[];
  final client=MockClient((request) async {
   if(request.method=='GET') { expect(request.headers['x-ticket-signature'],'signed-proof'); expect(request.headers.containsKey('x-order-email'),false); return json({'paid':false,'status':'pending'}); }
   final body=jsonDecode(request.body) as Map<String,dynamic>; bodies.add(body);
   return json({'success':true,'orderId':'order','accessSignature':'signed-proof','flow':'velocity-seamless','amount':20,'currency':'USD'});
  });
  TicketPulseApi api()=>TicketPulseApi(baseUrl:Uri.parse('https://example.test'),store:store,client:client);
  final first=api(); final key=await first.checkoutRequestId('event');
  final restarted=api(); expect(await restarted.checkoutRequestId('event'),key);
  final result=await restarted.startCheckout(eventSlug:'event',name:'Buyer',email:'buyer@example.com',phone:'0771234567',paymentMethod:'velocity-ecocash',items:[],expectedAmount:20,expectedCurrency:'USD');
  expect(bodies.single['checkoutRequestId'],key); expect(bodies.single['expectedAmount'],20);
  expect((await restarted.activeCheckout())!['result']['accessSignature'],'signed-proof');
  await restarted.checkoutStatus(result.orderId,result.accessSignature);
 });
 test('ambiguous initiation preserves signed order instead of discarding it', () async {
  final api=TicketPulseApi(baseUrl:Uri.parse('https://example.test'),store:MemoryStore(),client:MockClient((_)async=>json({'error':'Still checking','orderId':'order','accessSignature':'signed-proof','recoverable':true},502)));
  final result=await api.startCheckout(eventSlug:'event',name:'Buyer',email:'buyer@example.com',phone:'0771234567',paymentMethod:'velocity-ecocash',items:[],expectedAmount:20,expectedCurrency:'USD');
  expect(result.orderId,'order');expect(result.accessSignature,'signed-proof');expect(result.pollRequired,true);
  expect((await api.activeCheckout())!['result']['orderId'],'order');
 });
}
