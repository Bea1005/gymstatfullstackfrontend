import { Link } from 'react-router-dom';
import './SplashScreen.css';

const landingPolicies = {
  terms: {
    title: 'GYMSTAT SYSTEM — TERMS OF SERVICE',
    sections: [
      {
        heading: 'Purpose and agreement',
        paragraphs: [
          'The GYMSTAT System is designed to support the management, submission, verification, and monitoring of student-athlete requirements and related gymnasium records. By accessing and using the system, users acknowledge and agree to follow these Terms of Service.',
        ],
      },
      {
        heading: 'Information and documents',
        paragraphs: [
          'Users are expected to provide truthful, complete, and accurate information when registering an account and submitting requirements. Each user is responsible for reviewing the information and documents provided before completing a submission.',
          'All requirements submitted through GYMSTAT must be legitimate, valid, and authorized for the student’s use. The submission of forged, falsified, altered, misleading, or unauthorized documents is strictly prohibited. Users must not use the system to submit information or documents belonging to another person without proper authorization.',
        ],
      },
      {
        heading: 'Account and system use',
        paragraphs: [
          'Users are responsible for maintaining the confidentiality of their account credentials and for using the system only for legitimate academic, student-athlete, administrative, and gymnasium-related purposes. Users must not attempt to access another person’s account or records, interfere with system operations, or misuse information obtained through the system.',
        ],
      },
      {
        heading: 'Review and consequences',
        paragraphs: [
          'Submitted requirements may be reviewed and processed by authorized GYMSTAT personnel for verification, approval, record management, participation, and other legitimate institutional purposes. The status of a submitted requirement may change based on the result of the authorized review process.',
          'Violation of these Terms of Service may result in the rejection of submitted requirements, restriction of system access, or appropriate disciplinary action in accordance with applicable institutional policies and regulations.',
        ],
      },
      {
        heading: 'Acknowledgment',
        paragraphs: [
          'By using GYMSTAT and submitting information or requirements through the system, users acknowledge that they have read, understood, and agreed to these Terms of Service.',
        ],
      },
    ],
  },
  privacy: {
    title: 'GYMSTAT SYSTEM — PRIVACY POLICY',
    sections: [
      {
        heading: 'Collection and purpose',
        paragraphs: [
          'The GYMSTAT System respects the privacy of its users and is committed to protecting personal information submitted through the system. Information provided by students and other authorized users may be collected, stored, accessed, and processed only for legitimate purposes related to student-athlete requirements, verification, participation, record management, scheduling, and authorized administrative activities.',
        ],
      },
      {
        heading: 'Access and security',
        paragraphs: [
          'Personal information and uploaded requirement files should only be accessed by authorized users and personnel according to their assigned system roles and permissions. GYMSTAT should apply appropriate security measures to help protect information and uploaded documents against unauthorized access, disclosure, alteration, loss, or misuse.',
          'Students are expected to provide accurate and necessary information when using GYMSTAT. Uploaded requirements may contain personal or supporting information and should therefore be handled only for legitimate purposes connected to the student’s participation and institutional records.',
        ],
      },
      {
        heading: 'Retention and responsible submissions',
        paragraphs: [
          'GYMSTAT may retain submitted information and requirement records when necessary for legitimate institutional, administrative, verification, and record-management purposes. Users should avoid submitting unnecessary personal information or documents that are not required by the system or authorized personnel.',
          'The submission of forged, falsified, altered, misleading, or unauthorized documents is prohibited. Any student who violates applicable requirements or policies, including the submission of fraudulent documents, may be subject to appropriate disciplinary action under applicable institutional rules. Such action may include removal from or disqualification from a team or activity when authorized by the applicable institutional policies.',
        ],
      },
      {
        heading: 'REPUBLIC ACT NO. 10173 — DATA PRIVACY ACT OF 2012',
        paragraphs: [
          'GYMSTAT recognizes the principles of Republic Act No. 10173, also known as the Data Privacy Act of 2012. Personal information collected through the system should be processed for legitimate and declared purposes and should be handled only by authorized persons with a lawful purpose for accessing it.',
          'The information and documents submitted by students should be protected through appropriate organizational, physical, and technical measures. Users are encouraged to provide only accurate and necessary information and to use the system responsibly when submitting personal information and requirements.',
          'The Data Privacy Act of 2012 provides a framework for protecting personal information and recognizing the rights of individuals regarding their personal data. GYMSTAT should handle student information consistently with applicable privacy requirements and institutional policies.',
          'By using GYMSTAT and submitting requirements through the system, users acknowledge that their information may be processed for legitimate system and institutional purposes subject to applicable privacy laws and policies.',
        ],
      },
    ],
  },
};

const LandingPolicyPage = ({ policy }) => {
  const { title, sections } = landingPolicies[policy] || landingPolicies.terms;

  return (
    <main className="landing-policy-page">
      <div className="landing-policy-page__content">
        <Link className="landing-policy-page__back" to="/landingpage">
          Back to GYMSTAT
        </Link>
        <h1>{title}</h1>
        {sections.map((section) => (
          <section className="landing-policy-page__section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
};

export default LandingPolicyPage;
