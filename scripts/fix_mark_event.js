const fs = require('fs');

const filePath = 'C:/Presenza/lib/Faculty/MarkEventAttendance.dart';
const backupPath = 'C:/Presenza/lib/Faculty/MarkEventAttendance.dart.bak';

let content = fs.readFileSync(filePath, 'utf8');
fs.writeFileSync(backupPath, content);

// 1. Fix white icon buttons on white AppBar
content = content.replace(
  'child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),',
  'child: CircularProgressIndicator(color: AppTheme.accent, strokeWidth: 2),'
);

content = content.replace(
  'icon: const Icon(Icons.wifi_tethering, color: Colors.white, size: 28),',
  'icon: const Icon(Icons.wifi_tethering, color: AppTheme.accent, size: 26),'
);

content = content.replace(
  'icon: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 24),',
  'icon: const Icon(Icons.qr_code_scanner, color: AppTheme.slate700, size: 24),'
);

content = content.replace(
  'icon: const Icon(Icons.save, color: Colors.white),',
  'icon: Icon(Icons.save_rounded, color: studentDetails.isEmpty ? AppTheme.slate300 : AppTheme.accent, size: 24),'
);

// 2. Fix and accelerate _fetchStudents()
const oldFetchRegex = /Future<void> _fetchStudents\(\) async \{[\s\S]*?\}\s*Future<void> _submitAttendance\(\)/;

const newFetch = `Future<void> _fetchStudents() async {
    try {
      bool isTokenType = false;
      try {
        final eventDoc = await FirebaseFirestore.instance
            .collection('colleges')
            .doc('events')
            .collection('all_events')
            .doc(widget.eventId)
            .get();
        if (eventDoc.exists) {
          isTokenType = eventDoc.data()?['eventType'] == 'token';
        }
      } catch (_) {}

      // Batch query approved ODs for this event if not a direct token event
      Set<String> approvedStudentIds = {};
      if (!isTokenType) {
        final odQuery = await FirebaseFirestore.instance
            .collection('colleges')
            .doc('od_requests')
            .collection('all_requests')
            .where('eventId', isEqualTo: widget.eventId)
            .where('status', isEqualTo: 'approved')
            .get();
        for (var doc in odQuery.docs) {
          final sId = doc.data()['studentId'];
          if (sId != null) approvedStudentIds.add(sId.toString());
        }
      }

      final targetIds = isTokenType
          ? widget.students
          : widget.students.where((id) => approvedStudentIds.contains(id)).toList();

      // Parallel fetch all target students to avoid slow sequential roundtrips
      final studentDocs = await Future.wait(
        targetIds.map((sId) => FirebaseFirestore.instance
            .collection('colleges')
            .doc('students')
            .collection('all_students')
            .doc(sId)
            .get()),
      );

      List<Map<String, dynamic>> details = [];
      for (var doc in studentDocs) {
        if (doc.exists && doc.data() != null) {
          final data = doc.data()!;
          final sId = doc.id;
          details.add({
            'id': sId,
            'name': data['name'] ?? 'Unknown',
            'department': data['department'] ?? '',
            'semester': data['semester']?.toString() ?? (data['currentSemester'] is Map ? data['currentSemester']['semester'] : data['currentSemester'])?.toString() ?? 'V',
          });
          attendanceStatus[sId] = 'A'; // Default absent for events
        }
      }

      // Sort alphabetically by student name
      details.sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
      
      if (!mounted) return;
      setState(() {
        studentDetails = details;
        isLoading = false;
      });
    } catch (e) {
      debugPrint("Error fetching event students: $e");
      if (!mounted) return;
      setState(() => isLoading = false);
    }
  }

  Future<void> _submitAttendance()`;

if (oldFetchRegex.test(content)) {
  content = content.replace(oldFetchRegex, newFetch);
  console.log('Successfully replaced _fetchStudents!');
} else {
  console.error('Could not match oldFetchRegex!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated MarkEventAttendance.dart successfully!');
