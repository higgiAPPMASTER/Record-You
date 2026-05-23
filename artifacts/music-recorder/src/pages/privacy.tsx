export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto p-8 prose prose-invert">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: May 23, 2026</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Overview</h2>
        <p className="text-muted-foreground">
          Record You ("the app") is a music recording and mixing application. This policy explains what data
          we collect, how we use it, and your rights regarding that data.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Data We Collect</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li><strong className="text-foreground">Audio recordings</strong> — files you record using the app's microphone. These are stored locally on your device and, if you choose to sync, uploaded to our secure cloud storage.</li>
          <li><strong className="text-foreground">Song metadata</strong> — titles, tags, duration, and timestamps you assign to your recordings.</li>
          <li><strong className="text-foreground">Microphone access</strong> — used only while you are actively recording. We do not record audio in the background.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Data We Do Not Collect</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>We do not collect your name, email address, or any account information.</li>
          <li>We do not track your location.</li>
          <li>We do not share your data with third parties for advertising.</li>
          <li>We do not sell your data.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Microphone Permission</h2>
        <p className="text-muted-foreground">
          The app requests microphone access solely to enable audio recording. Microphone access is only
          active while you are on the recording screen and have pressed record. You can revoke this permission
          at any time in your device settings.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Cloud Storage</h2>
        <p className="text-muted-foreground">
          If you use the cloud sync feature, your audio files are uploaded to secure cloud storage. Files
          are stored only for the purpose of making them accessible across your devices. You can delete
          any file at any time from within the app.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Data Retention</h2>
        <p className="text-muted-foreground">
          Local recordings remain on your device until you delete them. Cloud recordings are deleted
          immediately when you remove them from the app. We do not retain backups of deleted files.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Children's Privacy</h2>
        <p className="text-muted-foreground">
          Record You is not directed at children under the age of 13. We do not knowingly collect
          personal information from children under 13.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Changes to This Policy</h2>
        <p className="text-muted-foreground">
          We may update this policy from time to time. Any changes will be reflected on this page
          with an updated date.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Contact</h2>
        <p className="text-muted-foreground">
          If you have any questions about this privacy policy, you can reach us through the
          Google Play Store listing for Record You.
        </p>
      </section>
    </div>
  );
}
