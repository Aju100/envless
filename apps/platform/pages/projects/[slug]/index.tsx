import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { generateKey } from "@47ng/cloak";
import useUpdateEffect from "@/hooks/useUpdateEffect";
import ProjectLayout from "@/layouts/Project";
import { useBranchesStore } from "@/store/Branches";
import { getServerSideSession } from "@/utils/session";
import { withAccessControl } from "@/utils/withAccessControl";
import {
  Branch,
  EncryptedProjectKey,
  Project,
  UserPublicKey,
  UserRole,
} from "@prisma/client";
import { GitBranch, GitBranchPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import BranchDropdown from "@/components/branches/BranchDropdown";
import CreateBranchModal from "@/components/branches/CreateBranchModal";
import EncryptionSetup from "@/components/projects/EncryptionSetup";
import { EnvironmentVariableEditor } from "@/components/projects/EnvironmentVariableEditor";
import { Button } from "@/components/theme";
import OpenPGP from "@/lib/encryption/openpgp";
import prisma from "@/lib/prisma";

/**
 * A functional component that represents a project.
 * @param {Props} props - The props for the component.
 * @param {Projects} props.projects - The projects the user has access to.
 * @param {currentProject} props.currentProject - The current project.
 * @param {currentRole} props.currentRole - The user role in current project.
 */
interface Props {
  user: object;
  projects: Project[];
  currentProject: Project;
  currentRole: UserRole;
  publicKey: UserPublicKey["key"];
  encryptedProjectKey: EncryptedProjectKey;
  branches: any;
  privateKey: string;
}

interface PersonalKey {
  publicKey: UserPublicKey["key"];
  privateKey: string;
}

interface ProjectKey {
  decryptedProjectKey: string;
  encryptedProjectKey: EncryptedProjectKey["encryptedKey"];
}

export const ProjectPage = ({
  user,
  projects,
  currentProject,
  currentRole,
  publicKey,
  encryptedProjectKey,
  branches,
  privateKey,
}: Props) => {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  const [encryptionKeys, setEncryptionKeys] = useState<{
    personal: PersonalKey;
    project: ProjectKey;
  }>({
    personal: {
      publicKey: publicKey,
      privateKey: privateKey || "",
    },
    project: {
      decryptedProjectKey: "",
      encryptedProjectKey: encryptedProjectKey?.encryptedKey,
    },
  });
  const { setBranches } = useBranchesStore();
  const router = useRouter();
  const { branch } = router.query;

  const getSelectedBranch = () => {
    if (branch) {
      return branches.filter((b) => b.name === branch)[0];
    }
    return branches.filter((b) => b.name === "main")[0];
  };

  const memoizedSelectedBranch = useMemo(
    () => getSelectedBranch(),
    [getSelectedBranch],
  );

  useUpdateEffect(() => {
    const sessionUser = session?.user as any;
    const getPrivateKey = sessionUser?.privateKey as string;

    if (getPrivateKey) {
      setEncryptionKeys({
        ...encryptionKeys,
        personal: {
          ...encryptionKeys.personal,
          privateKey: getPrivateKey,
        },
      });
    }
  }, [encryptionKeys.personal.publicKey]);

  useUpdateEffect(() => {
    (async () => {
      let privateKey = encryptionKeys.personal.privateKey;

      if (!privateKey) {
        const sessionUser = session?.user as any;
        privateKey = sessionUser?.privateKey as string;
      }

      const encryptedProjectKey = encryptionKeys.project.encryptedProjectKey;

      if (privateKey) {
        const decryptedProjectKey = (await OpenPGP.decrypt(
          encryptedProjectKey,
          privateKey,
        )) as string;

        setEncryptionKeys({
          personal: {
            ...encryptionKeys.personal,
            privateKey: privateKey,
          },
          project: {
            ...encryptionKeys.project,
            decryptedProjectKey: decryptedProjectKey,
          },
        });
      }
    })();
  }, [encryptionKeys.project.encryptedProjectKey]);

  useEffect(() => {
    setBranches(branches);
  }, [branches, setBranches]);

  return (
    <ProjectLayout
      projects={projects}
      currentProject={currentProject}
      currentRole={currentRole}
    >
      {encryptionKeys.personal.privateKey.length === 0 ? (
        <EncryptionSetup
          user={user}
          project={currentProject}
          encryptionKeys={encryptionKeys}
          setEncryptionKeys={setEncryptionKeys}
        />
      ) : (
        <>
          <div className="w-full">
            <div className="flex w-full items-center justify-between">
              <div className="mt-4 flex items-center justify-center gap-4">
                <BranchDropdown
                  label="Current Branch"
                  dropdownLabel="Switch between branches"
                  branches={branches}
                  selectedBranch={memoizedSelectedBranch}
                  currentProjectSlug={currentProject.slug}
                />

                <Link
                  className="group flex items-center text-sm transition-colors"
                  href={`/projects/${currentProject.slug}/branches`}
                >
                  <GitBranch className="text-lighter mr-1 h-4 w-4 group-hover:text-teal-400" />
                  <span className="text-light group-hover:text-teal-400">
                    {branches.length}{" "}
                    {branches.length === 1 ? "branch" : "branches"}
                  </span>
                </Link>
              </div>

              <Button
                onClick={() => setIsOpen(true)}
                leftIcon={<GitBranchPlus className="mr-3 h-4 w-4" />}
              >
                Create new branch
              </Button>
            </div>
          </div>

          <EnvironmentVariableEditor branchId={memoizedSelectedBranch.id} />

          <CreateBranchModal
            onSuccessCreation={(branch: Branch) => {
              router.push(
                `/projects/${currentProject.slug}?branch=${branch.name}`,
              );
            }}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
          />
        </>
      )}
    </ProjectLayout>
  );
};

export const getServerSideProps = withAccessControl({
  withEncryptedProjectKey: true,
  hasAccess: {
    owner: true,
    maintainer: true,
    developer: true,
    guest: true,
  },

  getServerSideProps: async (context) => {
    const session = await getServerSideSession(context);
    const user = session?.user;
    // @ts-ignore
    const { slug } = context.params;

    const currentProject = await prisma.project.findFirst({
      where: { slug: slug as string },
      select: {
        id: true,
        encryptedProjectKey: {
          select: { id: true, encryptedKey: true },
        },
        branches: {
          select: {
            id: true,
            name: true,
            protected: true,
          },
        },
      },
    });

    const userPublicKey = await prisma.userPublicKey.findFirst({
      where: { userId: user?.id },
      select: { key: true },
    });

    const publicKey = userPublicKey?.key;
    let encryptedProjectKey = currentProject?.encryptedProjectKey;
    const branches = currentProject?.branches;

    if (publicKey && !encryptedProjectKey) {
      const decryptedProjectKey = await generateKey();

      const encryptedKey = (await OpenPGP.encrypt(decryptedProjectKey, [
        publicKey,
      ])) as string;

      encryptedProjectKey = await prisma.encryptedProjectKey.create({
        data: {
          encryptedKey,
          projectId: currentProject?.id as string,
        },
      });
    }

    return {
      props: {
        privateKey: user?.privateKey,
        encryptedProjectKey,
        branches,
      },
    };
  },
});

export default ProjectPage;
