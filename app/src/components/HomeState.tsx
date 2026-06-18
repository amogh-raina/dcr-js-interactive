import styled from "styled-components";
import { StateEnum, type StateProps } from "../App";
import { basePath } from "../utilComponents/basePath";

const Container = styled.div`
  min-height: 100%;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 2rem;
`;

const Header = styled.h1`
  font-size: 100px;
  text-align: center;

  @media (max-width: 700px) {
    font-size: 56px;
  }
`;

const WorkflowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1.5rem;
  width: min(100%, 90rem);
  margin: 0 auto;
`;

const ImgContainer = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 15rem;
  padding: 1.25rem;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  background: white;
  color: black;
  cursor: pointer;
  font: inherit;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);

  &:hover {
    color: white;
    background-color: black;
  }

  &:focus-visible {
    outline: 3px solid black;
    outline-offset: 3px;
  }
`;

const Img = styled.img`
  width: 9rem;
  height: 9rem;
  background-color: gainsboro;
  border-radius: 50%;
  padding: 1.25rem;
  margin-top: 1rem;
`;

const ImgLabel = styled.div`
  text-align: center;
  font-size: 28px;
  line-height: 1.2;
`;

// Logos from https://www.svgrepo.com/collection/education-sephia-filled-icons/
function HomeState({ setState }: StateProps) {
  return (
    <Container>
      <Header>DCR-JS</Header>
      <WorkflowGrid>
        <ImgContainer
          onClick={() => setState(StateEnum.Modeler)}
          type="button"
        >
          <ImgLabel>Modeling</ImgLabel>
          <Img src={basePath("/icons/modeling.svg")} alt="" aria-hidden="true" />
        </ImgContainer>
        <ImgContainer
          onClick={() => setState(StateEnum.Simulator)}
          type="button"
        >
          <ImgLabel>Simulation</ImgLabel>
          <Img src={basePath("/icons/simulation.svg")} alt="" aria-hidden="true" />
        </ImgContainer>
        <ImgContainer
          onClick={() => setState(StateEnum.Conformance)}
          type="button"
        >
          <ImgLabel>Conformance</ImgLabel>
          <Img src={basePath("/icons/conformance.svg")} alt="" aria-hidden="true" />
        </ImgContainer>
        <ImgContainer
          onClick={() => setState(StateEnum.Discovery)}
          type="button"
        >
          <ImgLabel>Discovery</ImgLabel>
          <Img src={basePath("/icons/discovery.svg")} alt="" aria-hidden="true" />
        </ImgContainer>
        <ImgContainer
          onClick={() => setState(StateEnum.EventLogGeneration)}
          type="button"
        >
          <ImgLabel>Log Generation</ImgLabel>
          <Img
            src={basePath("/icons/logGeneration.svg")}
            alt=""
            aria-hidden="true"
          />
        </ImgContainer>
      </WorkflowGrid>
    </Container>
  );
}

export default HomeState;
