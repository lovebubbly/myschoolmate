
import { prisma } from '@/lib/prisma';

(async () => {
    try {
        console.log("=== Verification ===");

        // Check Tracks
        const tracks = await prisma.track.findMany({ include: { courses: true } });
        console.log(`Tracks found: ${tracks.length}`);
        tracks.forEach(t => console.log(`- ${t.name}: ${t.courses.length} courses`));

        // Check Courses
        const courseCount = await prisma.course.count();
        console.log(`Total Courses: ${courseCount}`);
        const sampleCourses = await prisma.course.findMany({ take: 3 });
        console.log("Sample Courses:", sampleCourses);

        // Check Profile
        const profile = await prisma.userProfile.findFirst();
        console.log("User Profile:", profile);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
})();
