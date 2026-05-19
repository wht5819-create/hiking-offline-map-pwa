import 'package:flutter/material.dart';

import '../features/home/presentation/pages/hiking_home_page.dart';

class HikingApp extends StatelessWidget {
  const HikingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: '登山離線地圖',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff2f6f4f)),
        useMaterial3: true,
      ),
      home: const HikingHomePage(),
    );
  }
}
