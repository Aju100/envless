import Link from "next/link";
import Logo from "@/components/base/Logo";
import { PrimaryLink } from "@/components/base/Buttons";

const Navigation = ({ ...props }) => {
  const { loggedIn } = props;

  return (
    <nav className="sticky top-0 z-50 mx-auto flex flex-wrap items-center justify-between bg-darkest/80 py-6 lg:justify-between">
      <div className="flex w-auto flex-wrap items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="flex items-center text-center">
        <PrimaryLink
          target="_self"
          sr="Signup or Login"
          href={loggedIn ? "/console" : "/auth"}
        >
          {loggedIn ? "Console" : "Get started 🎉"}
        </PrimaryLink>
      </div>
    </nav>
  );
};

export default Navigation;
