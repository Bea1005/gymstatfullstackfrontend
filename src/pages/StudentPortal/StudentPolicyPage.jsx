import { Link } from 'react-router-dom';

const policies = {
  terms: {
    title: 'GYMSTAT SYSTEM — TERMS OF SERVICE',
    sections: [
      {
        heading: 'Purpose',
        paragraphs: [
          'The GYMSTAT System is provided to support the management, submission, monitoring, and processing of student-athlete requirements and related gymnasium records.',
        ],
      },
      {
        heading: 'Accounts and submissions',
        paragraphs: [
          'By using the GYMSTAT System, users agree to provide truthful, complete, and accurate information when creating an account and submitting requirements. Users are responsible for reviewing their information and uploaded documents before submission.',
          'Students must only upload legitimate documents that belong to them and are required for their participation or registration. The submission of forged, falsified, misleading, or unauthorized documents is prohibited.',
        ],
      },
      {
        heading: 'Proper use of the system',
        paragraphs: [
          "Users must not misuse the system, attempt to access another user's account or records, interfere with system operations, or submit information for another person without proper authorization.",
        ],
      },
      {
        heading: 'Review and consequences',
        paragraphs: [
          'Submitted requirements may be reviewed by authorized GYMSTAT personnel for verification, approval, rejection, record management, and other legitimate administrative purposes related to student-athlete activities.',
          'Failure to follow these terms may result in the rejection of submitted requirements, account restrictions, disciplinary action, or other appropriate action in accordance with applicable institutional policies.',
        ],
      },
      {
        heading: 'Acknowledgment',
        paragraphs: [
          'By continuing to use GYMSTAT and submitting requirements, users acknowledge that they have read and understood these Terms of Service.',
        ],
      },
    ],
  },
  privacy: {
    title: 'GYMSTAT SYSTEM — PRIVACY POLICY',
    sections: [
      {
        heading: 'Collection and use',
        paragraphs: [
          'By uploading requirements or files to the GYMSTAT System, users acknowledge and agree that the information and documents they provide may be collected, stored, reviewed, and processed for legitimate purposes related to student-athlete requirements, verification, participation, scheduling, and record management.',
        ],
      },
      {
        heading: 'Accuracy of submitted information',
        paragraphs: [
          'Users warrant that the requirements and information they submit are accurate, valid, and provided for their legitimate use. Users are prohibited from uploading forged, falsified, misleading, or unauthorized documents.',
        ],
      },
      {
        heading: 'Access and protection',
        paragraphs: [
          'Submitted student information and requirement files should only be accessible to authorized users and personnel according to their assigned role and system permissions. Information should not be unnecessarily exposed to other users.',
        ],
      },
      {
        heading: 'Retention and responsibility',
        paragraphs: [
          'GYMSTAT may retain submitted requirements and related records as necessary for legitimate institutional and system-management purposes. Students are responsible for ensuring that the information they provide is correct and appropriate before submission.',
        ],
      },
      {
        heading: 'Policy violations',
        paragraphs: [
          'Any student found violating these requirements, including the submission of forged or falsified documents, may be subject to disciplinary action in accordance with applicable institutional rules and policies. Such action may include removal from or disqualification from a team or activity when appropriate.',
        ],
      },
      {
        heading: 'Republic Act No. 10173 — Data Privacy Act of 2012',
        paragraphs: [
          'The GYMSTAT System respects students’ personal information in accordance with Republic Act No. 10173, also known as the Data Privacy Act of 2012.',
          'Personal information and uploaded requirements should be processed and accessed only for legitimate purposes, including requirement verification, student-athlete records, participation, and authorized administrative activities. Access should be limited to authorized personnel based on their assigned system roles.',
          'GYMSTAT should apply appropriate measures to help protect information from unauthorized access, disclosure, alteration, or misuse. Students are encouraged to provide only accurate and necessary information.',
        ],
      },
      {
        heading: 'Acknowledgment',
        paragraphs: [
          'By submitting requirements through GYMSTAT, users acknowledge and understand how their submitted information and documents are handled within the system.',
        ],
      },
    ],
  },
};

const StudentPolicyPage = ({ policy }) => {
  const { title, sections } = policies[policy] || policies.terms;

  return (
    <article className="student-policy-page" aria-labelledby="student-policy-title">
      <Link className="student-policy-page__back" to="/student/requirements">
        Back to Requirements
      </Link>
      <h1 id="student-policy-title">{title}</h1>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
};

export default StudentPolicyPage;
