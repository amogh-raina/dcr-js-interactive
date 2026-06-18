import styled from "styled-components";
import { StateEnum, type StateProps } from "../App";
import FlexBox from "../utilComponents/FlexBox";
import { basePath } from "../utilComponents/basePath";

const Container = styled.div`
  height: 100%;
  width: 100%;
  overflow-y: scroll;
`;

const Header = styled.h1`
  font-size: 100px;
  text-align: center;
`;

const ImgContainer = styled.button`
  display: flex;
  flex-direction: column;
  padding: 0;
  border: none;
  border-radius: 50%;
  width: 30rem;
  height: 30rem;
  background: transparent;
  color: black;
  cursor: pointer;
  font: inherit;
  &:hover {
    color: white;
    background-color: black;
  }
`;

const Img = styled.img`
  width: 20rem;
  height: 20rem;
  background-color: gainsboro;
  border-radius: 50%;
  margin: auto;
`;

const ImgLabel = styled.div`
  text-align: center;
  font-size: 40px;
  margin-top: 1rem;
`;

// Logos from https://www.svgrepo.com/collection/education-sephia-filled-icons/
function HomeState({ setState }: StateProps) {
  return (
    <Container>
      <Header>DCR-JS</Header>
      <FlexBox direction="row" $justify="space-around">
        <ImgContainer
          aria-label="Open Modeling"
          onClick={() => setState(StateEnum.Modeler)}
          type="button"
        >
          <ImgLabel>
            <br />
            Modeling
          </ImgLabel>
          <Img src={basePath("/icons/modeling.svg")} alt="Modeling workflow icon" />
        </ImgContainer>
        <ImgContainer
          aria-label="Open Simulation"
          onClick={() => setState(StateEnum.Simulator)}
          type="button"
        >
          <ImgLabel>
            <br />
            Simulation
          </ImgLabel>
          <Img src={basePath("/icons/simulation.svg")} alt="Simulation workflow icon" />
        </ImgContainer>
        <ImgContainer
          aria-label="Open Conformance"
          onClick={() => setState(StateEnum.Conformance)}
          type="button"
        >
          <ImgLabel>
            <br />
            Conformance
          </ImgLabel>
          <Img src={basePath("/icons/conformance.svg")} alt="Conformance workflow icon" />
        </ImgContainer>
        <ImgContainer
          aria-label="Open Discovery"
          onClick={() => setState(StateEnum.Discovery)}
          type="button"
        >
          <ImgLabel>
            <br />
            Discovery
          </ImgLabel>
          <Img src={basePath("/icons/discovery.svg")} alt="Discovery workflow icon" />
        </ImgContainer>
        <ImgContainer
          aria-label="Open Log Generation"
          onClick={() => setState(StateEnum.EventLogGeneration)}
          type="button"
        >
          <ImgLabel>
            <br />
            Log Generation
          </ImgLabel>
          <Img
            src={basePath("/icons/logGeneration.svg")}
            alt="Log generation workflow icon"
          />
        </ImgContainer>
      </FlexBox>
    </Container>
  );
}

export default HomeState;
